---
name: remediate-apply
disable-model-invocation: true
description: >
  手动触发的「问题&推荐方案文档 → 逐条落地修复」执行器。接收一份 remediation 文档（典型如 remediate-suggest
  产出的 *-remediation.md，或任意带推荐方案的 finding 清单），按原文档顺序逐个派独立 subagent——每个在隔离
  上下文里先复核该 finding 是否已被修复，再按选定方案改代码、跑测试、修复后验证、提交（一问题一 commit），并在
  文档对应块回写状态标签。多方案无明确的方案选择表达（字段名不限，`[推荐]` 标记不算人工选择）时不臆测推荐项，
  标「待人工选定」后跳过该条、继续下一条。代码修复提交；remediation 文档的标签更新只写回、不提交。
---

# Remediate Apply Skill

```
/remediate-apply <remediation 文档路径>            # 按原文档顺序逐条修复
/remediate-apply <remediation 文档路径> SEC ARCH    # 仅修复 id 命中前缀的 finding
```

> 始终**手动指定** remediation 文档路径。已带 `- **status**:` 标签的 finding 自动跳过——可断点续跑；人工处理后删除该行即重新入队。

## 定位

**消费 remediation 文档、逐条落地修复**：与 `remediate-suggest` 对仗——后者只分析给推荐方案，本 skill 执行那些方案。主 agent 只解析与编排、一次性预探测共享上下文；每条 finding 在独立 subagent 里完成「复核 → 选方案 → 改码 → 测试验证 → 提交」，避免主会话上下文污染与膨胀。

**与相关 skill 的关系（均为 skill 级引用）**：
- **上游**：`remediate-suggest`——其产物 `*-remediation.md` 是典型输入，但不强依赖：任何「finding + 推荐方案」结构的文档都可喂入（字段名宽容——自然语言段落、`**suggest**:` 字段、`方案 A` 列表等都算）。
- **规范基准**：`code-conventions`——subagent 改码前加载（若已装载），缺失则降级。
- **单问题 / 泛型列表**：`diagnose-and-fix` / `diagnose-and-fix-batch`——处理非 remediation 文档形态的输入，与本 skill 正交。

---

## 主流程（Main Agent）

### Step 0 — 输入检查

- **文件存在？** 不存在 → 报错停止。
- **格式像 remediation / finding 清单？** 必须含 `### [ID]` 块、且至少部分块带「推荐方案」表达（字段名宽容）。不像 → 提示「输入应是 remediation 文档（finding + 推荐方案）」后停止，不臆测。
- **`code-conventions` skill 是否装载？** 装载 → subagent prompt 里指示加载。未装载 → **不阻塞**，提示「建议装载以提升修复规范贴合度，现以降级模式继续」，最终摘要标注。

### Step 1 — 解析待修清单 + 预探测共享上下文

抽每个 finding 块：id、title、severity、location、evidence、impact、推荐方案表达、可选方案选择表达（字段名不限）、`related`。再**逐步收敛待修集合**：

1. **剔除已处理**：块末已有状态标签 → 跳过、**逐字保留**，不重跑。这是断点续跑的基础。
2. **前缀过滤**（若命令带前缀）：只保留 id 命中任一前缀的 finding（`SEC`/`ARCH`/`API-users`/…）。
3. **排队**：按原文档顺序，不重排、不停顿确认（顺序与范围由输入文档决定，用户已通过提供文档表达意图）。

**预探测共享上下文**（一次探测、注入所有 subagent，subagent 不再各自探测）：

- **测试命令**：Makefile `test` → `package.json scripts.test` → 语言约定命令；均无 → **问用户一次**，确认无测试则记「无测试」（subagent 跳过测试、仅自验，摘要注明）。
- **commit 风格**：`git log` 近 5 条归纳（type 集合/scope/语言）；无明显约定用缺省 `fix(<scope>): <subject>`（subject 动词原形开头、≤72 字符、不加句号）。
- **git 是否初始化**：未初始化 → subagent 跳过提交，摘要注明。

输出清单后直接开跑：

```
🔍 解析 remediation 文档 → 共 N 个 finding（已处理: x · 待修: y）
  待修队列（按原文档顺序）：[SEC-2] … · [ARCH-1] …
  测试命令: <cmd | 无测试> · commit 风格: <一句> · git: <ok | 未初始化>
逐条串行派发 y 个 subagent（每条一提交）…
```

### Step 2 — 串行派发 subagent

**逐条串行**（每条要提交代码，并行会工作区冲突）。每条派一个 `general-purpose` subagent，prompt 指示其先读 `<本 skill 目录绝对路径>/agents/remediate-one.md` 并遵循它，并注入：

- 该 finding 块原文（含推荐方案表达、方案选择表达（若有）、related）
- **关联 finding 的已修复状态**：若本条 `related` 指向已处理的 finding（本批次的，或文档已带标签的），摘其结论供复核「关联消解」参考；无则空
- 共享上下文：测试命令 / commit 风格 / git 状态 / `code-conventions` 是否装载

subagent 返回结构化 RESULT（见 `agents/remediate-one.md`）。主 agent 收到后：

1. **回写 remediation 文档**：在该 finding 块末尾追加 `- **status**:` 行（见下表），**不提交该文档变更**。
2. 追加进度行 `| ✅/⏭️/⚠️/❌ | [ID] | <标题> | <方案名/—> | <hash7/—> |`（首条先输出表头 `| 状态 | 编号 | 标题 | 方案 | code commit |`）。
3. 进下一条。

**状态标签回写格式**（块末追加 `- **status**:` 行）：

| RESULT status | 标签 |
|---|---|
| `fixed` | `- **status**: ✅ 已修复 → <hash7> · <方案名>` |
| `already-solved` | `- **status**: ⏭️ already-solved · <一句原因>` |
| `pending-decision` | `- **status**: ⚠️ 待人工选定方案 · <为何无法自动选>` |
| `unsupported` | `- **status**: ⚠️ 待人工核实 · <缺什么>` |
| `test-failed` | `- **status**: ❌ 修复未达标（测试/验证超限）` |

### Step 3 — 收尾全量回归（一次）+ 摘要

**全量回归**：fixed ≥ 1 且有测试命令时，主 agent 跑**一次**全量测试（subagent 只跑定向测试，不跑全量）。失败 → 不回滚、不改已回写标签，摘要列失败摘要与可疑 finding id，归入「需人工跟进」。

```
🏁 Remediate apply 完成
输入:      <remediation 文档路径>
处理:      y 条（fixed=a · already-solved=b · pending-decision=c · unsupported=d · test-failed=e）
code 提交:  a 个（每问题一 commit）
全量回归:  ✅ 通过 | ❌ 失败: <摘要 + 可疑 finding id> | 跳过（无 fixed / 无测试）
文档标签:  已回写 y 处 · ⚠️ remediation 文档未提交（提交时机由你掌控）
code-conventions: <已装载 | ⚠️ 降级>
需人工跟进: 列出 pending-decision / unsupported / test-failed（及回归失败可疑项）的 id
```

有需人工跟进的条目时补一句续跑指引：pending-decision 在该块写明方案选择（如 `solution: B`）、unsupported 补全所缺信息后，**删除该条 `- **status**:` 行**再重跑 `/remediate-apply <文档路径>` 即可续处理（其余已带标签的条目仍自动跳过）。全部 fixed 则本审计链（codebase-audit → remediate-suggest → remediate-apply）到此闭环。

---

## 硬约束

- **逐条串行 + 一问题一提交**：不并行修复；每条 finding 的代码改动独立 commit。
- **多方案无明确选择不臆测**：标 `pending-decision` 跳过，绝不自行挑 `[推荐]` 项改码。
- **remediation 文档只写不提交**：状态标签写回文档，但 `git add` 不包含该文档。
- **不复核不修复**：subagent 先复核「是否已被修复」再动手；已修复 → `already-solved`，不改码。
- **不发明问题**：只处理文档里列出的 finding；额外发现写进 RESULT `note`，不顺手修。

## 错误处理

| 情况 | 处理 |
|------|------|
| 输入文件不存在 / 不像 remediation 文档 | Step 0 停止，不臆测 |
| `code-conventions` 未装载 | 降级继续，摘要标注 |
| 无测试入口且用户确认无测试 | subagent 跳过测试仅自验，摘要注明 |
| subagent 返回 `unsupported` / `pending-decision` / `test-failed` | 回写对应标签，继续下一条（判定条件与含义见 `agents/remediate-one.md`） |
| subagent 崩溃 / 未返回 RESULT | 记为失败，回写 `- **status**: ⚠️ 待人工核实 · subagent 未返回`，继续下一条 |
| 零待修（全部已处理） | 正常收尾，提示「无可修 finding」 |
| git 未初始化 | subagent 跳过提交（`code_commit: none`），其余流程照常，摘要注明 |
