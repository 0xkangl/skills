---
name: remediate-apply
disable-model-invocation: true
description: >
  手动触发的「问题&推荐方案文档 → 逐条落地修复」执行器。接收一份 remediation 文档（典型如 remediate-suggest
  产出的 *-remediation.md，或任意带推荐方案的 finding 清单），按原文档顺序逐个派独立 subagent——每个在隔离
  上下文里先复核该 finding 是否已被修复，再按选定方案改代码、跑测试、修复后验证、提交（一问题一 commit），并在
  文档对应块回写状态标签。多方案无明确的方案选择表达（字段名不限）时不臆测推荐项，标「待人工选定」自动跳过下一条。代码修复
  提交；remediation 文档的标签更新只写回、不提交。
---

# Remediate Apply Skill

```
/remediate-apply <remediation 文档路径>            # 按原文档顺序逐条修复
/remediate-apply <remediation 文档路径> SEC ARCH    # 仅修复 id 命中前缀的 finding
```

> 始终**手动指定** remediation 文档路径。已带状态标签（`✅ 已修复` / `⏭️ already-solved` / `⚠️ 待人工选定方案` / `❌ 修复未达标`）的 finding 自动跳过——可断点续跑。

## 定位

**消费 remediation 文档、逐条落地修复**：与 `remediate-suggest` 对仗——后者**只分析**给推荐方案，本 skill **执行**那些方案。主 agent 只解析与编排；每条 finding 在独立 subagent 里完成「复核 → 选方案 → 改码 → 测试 → 验证 → 提交」，避免主会话上下文污染与膨胀。

**逐条串行 + 一问题一提交**：subagent 串行启动（一条提交完才进下一条，避免工作区冲突）；每条修复独立 commit，便于回滚与审查。

**多方案谨慎**：只有单方案、或带明确**方案选择表达**的多方案才执行（任何能看出「最终选了哪个」的写法都算，字段名不限——`solution: B` / `✅ 采用 B` / `已选 B` / `最终方案: B` 等）；多方案无明确选择 → 不臆测推荐项，标 `待人工选定方案` 自动跳过下一条。

**文档只写不提交**：remediation 文档对应 finding 块回写状态标签（已修复/已跳过/待人工），但该文档变更**不提交**（与 `diagnose-and-fix` 处理问题列表的惯例一致，提交时机交用户掌控）。

**字段宽容**：不强依赖 `suggest` 之类的严格字段名——任何能识别出「推荐方案/改法描述」的表达都算（自然语言段落、`**suggest**:` 字段、`方案 A` 列表等）。

**与相关 skill 的关系（均为 skill 级引用）**：
- **上游**：`remediate-suggest`——其产物 `*-remediation.md` 是本 skill 的典型输入，但本 skill **不强依赖**它：任何「finding + 推荐方案」结构的文档都可喂入。
- **规范基准**：`code-conventions`——subagent 改码前加载它（若已装载），确保修复贴合项目约定；缺失则降级。
- **单问题 / 泛型列表**：`diagnose-and-fix` / `diagnose-and-fix-batch`——处理自由文本单问题与泛型问题列表（非 remediation 文档形态），与本 skill 正交。

---

## 主流程（Main Agent）

### Step 0 — 输入检查

- **文件存在？** 不存在 → 报错停止。
- **格式像 remediation / finding 清单？** 必须含 `### [ID]` 块、且至少部分块带「推荐方案」表达（字段名宽容）。不像 → 提示「输入应是 remediation 文档（finding + 推荐方案）」后停止，不臆测。
- **`code-conventions` skill 是否装载？** 装载 → subagent prompt 里指示加载。未装载 → **不阻塞**，提示「建议装载以提升修复规范贴合度，现以降级模式继续」，最终摘要标注。

### Step 1 — 解析待修清单

抽每个 finding 块：id、title、severity、location、evidence、impact、推荐方案表达（整体方案/落点/细节，字段名宽容）、可选方案选择表达（字段名不限）/ `related`。再**逐步收敛待修集合**：

1. **剔除已处理**：块末已有状态标签（`✅ 已修复` / `⏭️ already-solved` / `⚠️ 待人工选定方案` / `⚠️ 待人工核实` / `❌ 修复未达标`）→ 跳过，**逐字保留**，不重跑。这是断点续跑的基础。
2. **前缀过滤**（若命令带前缀）：只保留 id 命中任一前缀的 finding（`SEC`/`ARCH`/`API-users`/…）。
3. **排队**：按原文档顺序（不重排、**不确认处理模式**——顺序与范围由输入文档决定，用户已通过提供文档表达意图）。

输出清单后**不停顿确认**：

```
🔍 解析 remediation 文档 → 共 N 个 finding（已处理: x · 待修: y）
  待修队列（按原文档顺序）：
  - [SEC-2] 鉴权中间件未覆盖 /admin 路由
  - [ARCH-1] ...
  ...
逐条串行派发 y 个 subagent（每条一提交）…
```

### Step 2 — 串行派发 subagent

**逐条串行**（非并行——每条要提交代码，并行会工作区冲突）。每条派一个 `general-purpose` subagent，prompt 指示其先读 `agents/remediate-one.md` 并遵循它，并注入：

- 该 finding 块原文（id/title/severity/location/evidence/impact/推荐方案表达/方案选择表达（若有）/related）
- **关联 finding 的已修复状态**：若本条 `related` 指向本批次已处理的 finding，主 agent 摘其结论（已修方案 / 已判 already-solved），供 subagent 复核「关联消解」时参考；无则空。
- `code-conventions` 是否装载

subagent 返回结构化 RESULT（见 `agents/remediate-one.md`）。主 agent 收到后：

1. **回写 remediation 文档**：在该 finding 块末尾追加 `- **status**:` 行（见下表），**不提交该文档变更**。
2. 追加进度行（首条先输出表头）：

```
| 状态 | 编号 | 标题 | 方案 | code commit |
|------|------|------|------|-------------|
| ✅/⏭️/⚠️/❌ | [ID] | <标题> | <方案名/—> | <hash7/—> |
```

3. 进下一条。

**状态标签回写格式**（块末追加 `- **status**:` 行）：

| RESULT status | 标签 |
|---|---|
| `fixed` | `- **status**: ✅ 已修复 → <hash7> · <方案名>` |
| `already-solved` | `- **status**: ⏭️ already-solved · <一句原因>` |
| `pending-decision` | `- **status**: ⚠️ 待人工选定方案 · <为何无法自动选>` |
| `unsupported` | `- **status**: ⚠️ 待人工核实 · <缺什么>` |
| `test-failed` | `- **status**: ❌ 修复未达标（测试/验证超限）` |

### Step 3 — 收尾摘要

```
🏁 Remediate apply 完成
输入:      <remediation 文档路径>
处理:      y 条（fixed=a · already-solved=b · pending-decision=c · unsupported=d · test-failed=e）
code 提交:  a 个（每问题一 commit）
文档标签:  已回写 y 处 · ⚠️ remediation 文档未提交（提交时机由你掌控）
code-conventions: <已装载 | ⚠️ 降级>
需人工跟进: 列出 pending-decision / unsupported / test-failed 的 id
```

---

## 硬约束

- **逐条串行 + 一问题一提交**：不并行修复；每条 finding 的代码改动独立 commit。
- **多方案无明确选择不臆测**：多方案且无明确的方案选择表达 → 标 `pending-decision` 跳过，**绝不**自行挑推荐项改码。
- **remediation 文档只写不提交**：状态标签写回文档，但 `git add` **不包含**该文档；提交时机交用户。
- **不复核不修复**：subagent 必须先复核「是否已被修复」再动手；已修复 → `already-solved`，不改码。
- **不发明问题**：只处理文档里列出的 finding；subagent 发现的额外问题写进 RESULT `note` 提示，不顺手修。

## 错误处理

| 情况 | 处理 |
|------|------|
| 输入文件不存在 | Step 0 报错停止 |
| 输入不像 remediation（无 `### [ID]` 块、无任何推荐方案表达） | 提示格式不符后停止，不臆测 |
| `code-conventions` 未装载 | 降级继续，摘要标注 |
| 某 finding 推荐方案表达缺失 / 不可核实 | subagent 返回 `unsupported`，回写标签，继续下一条 |
| 多方案无明确的方案选择表达 | subagent 返回 `pending-decision`，回写标签，继续下一条 |
| subagent 测试 / 修复验证重试超 3 次 | subagent 返回 `test-failed`，**不提交**，回写标签，继续下一条 |
| subagent 崩溃 / 未返回 RESULT | 记为失败（status 留空），回写 `⚠️ 待人工核实: subagent 未返回`，继续下一条 |
| 零待修（全部已处理） | 正常收尾，提示「无可修 finding」 |
| git 未初始化 | subagent 跳过提交（`code_commit: none`），其余流程照常，摘要注明 |
