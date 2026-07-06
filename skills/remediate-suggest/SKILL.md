---
name: remediate-suggest
disable-model-invocation: true
description: >
  手动触发的「审计问题清单 → 推荐修复方案」分析器。接收 codebase-audit 生成的 issues-report 文档，按问题根因/维度把 findings 分组，
  每组派一个独立 subagent——加载 code-conventions skill 作规范基准，对每条 finding 做存在性复核（含「关联问题修复后是否仍存在」），
  再产出标准推荐方案结构的 suggest 字段（整体方案 + 落点 + 实现细节与注意事项 + 改动量）。
  主 agent 合并产出与输入同目录的 <issues 文档名>-remediation.md（带 suggest 的镜像）。
  同目录已有该产物时自动进入追加模式——只补原报告里尚未进 remediation 的 finding，原地更新；
  同目录存在未合并的 <issues 文档名>-remediations/ 片段时自动续传——复用有效片段，只重派缺失的组。
  只分析不修复：不改被审代码、不跑测试、不提交。
---

# Remediate Suggest Skill

```
/remediate-suggest <issues-report 路径>            # 对整份报告补 suggest（自动检测追加 / 续传）
/remediate-suggest <issues-report 路径> SEC ARCH    # 仅处理指定维度/组（按 id 前缀过滤）
```

> 始终传**原 issues-report 路径**。同目录已有 `<issuesStem>-remediation.md` → 自动**追加**（补剩余 finding，原地更新）；
> 同目录有未合并的 `<issuesStem>-remediations/` 片段 → 自动**续传**（复用有效片段，只重派缺失的组）。两者可叠加。

## 定位

**只分析、不修复**：把一份 `issues-report` 升级成「带推荐修复方案的清单」。主 agent 只解析与编排；每个 subagent 在隔离上下文里读自己那组 findings 涉及的代码切片，复核存在性后写 `suggest`。不修改被审代码、不跑测试、不提交——这是写死的边界。

**渐进补全**：remediation 产物是原 report 的**子集镜像**——只含已分析过的 finding（带 suggest），未分析的不进文档。首次跑只处理一部分维度（如 `/remediate-suggest report.md SEC ARCH`）后，再跑会自动追加剩余维度，产物逐渐长成完整镜像。中途 session 断了（片段目录在、最终产物没合并）下次自动续传。

**与两个 skill 的关系（均为 skill 级引用，不链入对方目录文件）**：
- **上游输入**：`codebase-audit`——本 skill 的输入契约就是其 issues-report 产物的固定格式（按 P0/P1/P2/P3 分节、每条 `### [ID] <title>` 带 `sub-area/location/evidence/impact`）。
- **规范基准**：`code-conventions`——每个 subagent 写 `suggest` 前加载它，确保推荐方案贴合项目约定。缺失则降级、摘要注明。

> 推荐方案的字段口径（整体方案 + 落点 + 实现细节与注意事项 + 改动量、`[quick-fix]` / `[推荐]` 标记规则）是本 skill 自身定义的标准结构，不依赖其它 skill。

---

## 主流程（Main Agent）

### Step 0 — 依赖与输入检查

- **输入文件存在？** 不存在 → 报错停止。
- **格式像 issues-report？** 必须含 `## 🔴 P0` / `### [` 头节结构。不像 → 提示「输入应是 codebase-audit 的 issues-report 产物」后停止，不臆测。
- **已有产物检测（决定首轮 / 追加）**：查 `<issuesDir>/<issuesStem>-remediation.md` 是否存在。
  - 存在 → 读它，抽出 `alreadyDoneIds`（其中出现的 finding id 集合），标 `appendMode=true`。
  - 不存在 → 首轮，`alreadyDoneIds = ∅`。
- **`code-conventions` skill 是否装载？** 装载 → 子 agent prompt 里指示加载。未装载 → **不阻塞**，提示「建议装载以提升 suggest 规范贴合度，现以降级模式继续」，并在最终摘要标注 `⚠️ code-conventions 未装载，suggest 未基于规范基准`。

> 续传检测（片段目录复用判定）放 Step 1，需先分组才知道哪些片段该复用。

### Step 1 — 解析、命名与分组

先确定产物命名（跟随输入，不写死目录；输入始终是原 report，故 `baseStem = issuesStem`）：

- `issuesDir` = issues 文档所在目录；`issuesStem` = 文档名去掉 `.md`。
- 例：输入 `docs/audit/issues-report-2026070614.md` → `issuesDir=docs/audit`、`issuesStem=issues-report-2026070614`。
- 最终产物路径 = `<issuesDir>/<issuesStem>-remediation.md`（首轮创建 / 追加原地覆盖）；子 agent 片段目录 = `<issuesDir>/<issuesStem>-remediations/`。

再抽 issues-report 头部 meta（`scope` / `stack` / `date` / totals）和每个 finding 块（id、title、severity、sub-area、location、evidence、impact、`related`）。然后**逐步收敛待补集合**：

1. **去重已处理**（追加模式）：从全量 findings 里剔除 `id ∈ alreadyDoneIds` 的——它们已在 remediation 里带 suggest，**不重跑、逐字保留**。首轮模式此步为空。
2. **前缀过滤**（若命令带前缀）：在待补集合上只保留 id 命中任一前缀的 finding（`SEC`/`ARCH`/`API-users`/`FLOW-checkout`/…）。前缀未命中的 finding 留待下次追加，本次不处理。
3. **分组**（组 = 子 agent 派发粒度，目的是让关联问题在同一上下文里一起考虑，避免重复/冲突的方案）。**按以下规则**作用于待补集合：

   1. **同根因合并条目**（标题里多 id 并列，如 `[SEC-2] / [ARCH-1]`）→ 一组。
   2. **`related: [id]` 互指**（跨档同根因，且双方都在待补集合内）→ 同组。
   3. 其余 **按 id 前缀归并**：`SEC` / `ARCH` / `PERF` / `CODE` / `TEST` / `DEP` / `OBS` / `INFRA` / `FE` / `CONV` 各一组；`API-<group>` 每个分组一组；`FLOW-<flow>` 每条流程一组。

   得 `targetGroups`（本次应产出的全部组）。

4. **续传复用判定**：扫片段目录 `<issuesStem>-remediations/`，对每个 `targetGroup`：
   - 若 `<组key>.md` 存在、非空、含完整 `### [ID]` 块与 `**suggest**:` 字段，且**组内 id 集合与当前一致**（防 report 改过 / 分组变了的过期片段）→ **复用**，归入 `reuseGroups`。
   - 否则（缺失 / 残缺 / id 集合对不上）→ 归入 `dispatchGroups`，本次重派。
   - 片段目录里不在 `targetGroups` 的旧片段忽略——合并阶段只认 `targetGroups`，不主动删用户文件。

输出分组清单后**不停顿确认**（不修复、无副作用，可直接跑）：

```
🔍 解析 issues-report → 共 N 个 finding（模式: <首轮|追加> · 已进 remediation: x · 待补: y）
  待补分 M 组（reuse=a · dispatch=b）：
  - SEC（含 [SEC-2]/[ARCH-1] 同根因合并）: 4
  - API-users: 3
  - FLOW-checkout: 2
  ...
产物: <issuesDir>/<issuesStem>-remediation.md · 片段目录: <issuesDir>/<issuesStem>-remediations/
并发派发 b 个 subagent（a 个复用旧片段）…
```

### Step 2 — 并行派发 subagent

**只派 `dispatchGroups`**（`reuseGroups` 跳过）。**同一条 message 里发全部 Agent 调用 = 并行**（参考 `codebase-audit` 的并行派发约定）。每个 subagent 用 `general-purpose` 类型，prompt：

```
你是审计问题修复方案分析 agent。只分析、不修复——不改被审代码、不跑测试、不提交。

<scope>
scope: <报告头部 scope>
stack: <报告头部 stack>
</scope>

你负责这一组待补 finding（来自 issues-report；已有 suggest 的不在你视野）：
{组内各 finding 块原文，含 id/title/severity/sub-area/location/evidence/impact/related}

<关联已有结论（若组内 finding 的 related 指向已进 remediation 的 finding，主 agent 在此摘其 suggest 结论；无则为空）>
{例：[SEC-2] 已有方案——给 adminGroup 挂 middleware.RequireRole("admin")；若 [SEC-5] 与之同根因，判 (b) 时参考。}

先读 agents/remediate-group.md 并遵循它。核心三步：
1. 加载 code-conventions skill 作为推荐方案的规范基准（按 skill 名引用，不链入其目录文件）。
2. 存在性复核：对每条 finding 读 evidence 指向的代码，验证(a)问题是否真实存在；(b)同组关联问题
   或 <关联已有结论> 里的已补 finding 修复后，本条是否仍需独立方案。不存在/已消解 → 标
   `已消解/不复存在: <原因>` 或 `随 [id] 修复后消解`，不编方案。
3. 对仍存在的 finding 写 suggest 字段（标准推荐方案结构）。

把结果写到：<issuesDir>/<issuesStem>-remediations/<组key>.md（仅你这一组的片段）
只回一行：GROUP[<组key>]: kept=x resolved=y unsupported=z → <片段路径>
```

### Step 3 — 合并产出

主 agent 收齐 `dispatchGroups` 的新片段后，**把 `reuseGroups`（旧片段）+ `dispatchGroups`（新片段）+ 已有 remediation（追加模式时）全部 finding**，**按原 issues-report 的严重度分节与原始顺序**重拼为完整产物 `<issuesDir>/<issuesStem>-remediation.md`：

- 头部镜像原报告 meta 行（`scope · date · stack · 🔴 P0×a …`），追加一行 `> remediate-suggest 产物 · 只分析不修复 · code-conventions: <已装载|降级>`（追加模式下沿用原行、更新统计数）。
- **来自已有 remediation 的 finding 块**：逐字保留（含其 `suggest`），不重写。
- **来自本次片段（reuse + dispatch）的 finding 块**：原字段（`sub-area/location/evidence/impact`）逐字保留，块末嵌片段里的 `suggest` 字段。**不重写 evidence/impact，不发明新问题**。
- 同档内排序沿用原报告（不重排）；合并确认后删除片段目录 `<issuesStem>-remediations/`（合并失败则保留供重试）。

### Step 4 — 收尾摘要

```
✅ Remediate suggest 完成（<首轮 | 追加> {· 续传 reuse=a}）
输入:  <issues-report 路径>
产物:  <issuesDir>/<issuesStem>-remediation.md
分组:  M 组（reuse=a · dispatch=b）· 并行处理 dispatch
统计:  本次新补 kept=x（给出方案） resolved=y（已消解/不复存在，未编方案） unsupported=z（无法核实，标注待人工）
       remediation 累计 finding = <已进文档数> / 原报告 total = <N>
code-conventions: <已装载 | ⚠️ 降级>
```

---

## suggest 字段口径（subagent 遵守）

- **单方案**（根因清晰、最佳解唯一）：给一个，附一句「为何不考虑其它思路」。
- **多方案**（2–3 个各有取舍、代码本身无法裁决）：并列，每个配一句 trade-off，推荐项标 `[推荐]`。
- **机械修复**（无歧义、纯机械：日志级别、缺失 nil 检查、硬编码提配置、拼写、死导入）：名称后标 `[quick-fix]`，省去多方案对比。
- 字段内容：整体方案说明 + 落点文件/函数 + 实现细节与注意事项 + 改动量（小 <20 行 / 中 20–100 / 大 >100）。
- **存在性结果优先于方案**：finding 不复存在或随关联修复消解时，suggest 只写 `已消解/不复存在: <原因>` 或 `随 [id] 修复后消解`，**不编方案**。
- evidence 不足以核实的 → `待人工核实: <缺什么>`，不臆测方案。

## 硬约束

- **只分析、不修复**：不改被审代码、不跑测试、不格式化、不提交、不动 issues-report 原文件。
- **不重写已有 suggest**：追加 / 续传时，已进 remediation 的 finding 与已复用的片段逐字保留，绝不重跑、不覆盖。
- subagent 是**只读分析**角色——读代码、写片段，不触碰被审仓库的工作区。
- `suggest` 是推荐，不是承诺；产物明确标注「只分析不修复」。

## 错误处理

| 情况 | 处理 |
|------|------|
| 输入文件不存在 | Step 0 报错停止 |
| 输入不像 issues-report（无 P0/P1 分节、无 `[ID]` 块） | 提示格式不符后停止，不臆测 |
| `code-conventions` 未装载 | 降级继续，摘要标注 |
| 某 subagent 片段缺失/崩溃 | 该组 finding 的 suggest 填 `待人工核实: subagent 未返回`，其余组照常合并 |
| subagent 判定 evidence 不可核实 | 该条标 `待人工核实: <缺什么>`，计入 `unsupported` |
| 零 finding（原报告无问题 / 追加时已全部进 remediation） | 产物只含头部 + 「未发现可补 suggest 的 finding」，正常收尾 |
| 合并失败 | 保留片段目录 `<issuesStem>-remediations/` 供重试，不产出半成品 |
| 片段目录残留但某组片段残缺 / 组内 id 集合对不上（过期） | 该组判入 `dispatchGroups` 重跑，不强行复用 |
