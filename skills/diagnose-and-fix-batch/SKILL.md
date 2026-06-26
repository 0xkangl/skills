---
name: diagnose-and-fix-batch
disable-model-invocation: true
description: >
  手动触发的「问题列表批量修复」编排器。接收问题列表文件（.md/.json/.yaml/.txt）和可选编号，把未修复问题排成队列，
  逐个派发独立 subagent——每个 subagent 在隔离上下文里调用 diagnose-and-fix skill 完成单问题的「诊断 → 选方案 → 修复 → 测试 → 修复后验证 → 提交代码 → 标记列表」全流程，再回收结构化结果。
  **强依赖 diagnose-and-fix skill**（按 skill 名调用，单问题流程与终态均由其定义）。问题列表只标记 resolved、不提交（提交时机由用户掌控）。
  支持不填编号（自动检测未修复）、单个或多个编号。
---

# Diagnose and Fix (Batch) Skill

```
@diagnose-and-fix-batch <问题列表文件>              # 自动检测所有未修复问题
@diagnose-and-fix-batch <问题列表文件> 3            # 修复单个问题
@diagnose-and-fix-batch <问题列表文件> 3 7 BUG-012  # 修复多个问题（按序处理）
```

支持 `.md / .json / .yaml / .txt`，编号可为数字或字符串。

## 定位

**批量循环编排器**：主 agent 把问题列表拆成队列，逐个在独立 subagent 里修复（避免污染主会话），回收结构化结果。
单问题的「先诊断、用户选方案、再动手、修完验证、提交代码、标记列表」全流程**不在本 skill 内重复定义**——每个 subagent 调用 `diagnose-and-fix` skill 执行，本 skill 只负责排队、派发、回收、汇总。
问题列表**只标记 resolved、不提交**（由 `diagnose-and-fix` 在子流程内完成标记）——提交时机由用户统一掌控，本 skill 全程不碰列表文件的提交。

> **依赖**：本 skill 强依赖 `diagnose-and-fix` skill。主 agent 在 **Step 0** 先做存在性检查，缺失则直接提示用户、不进入任何 subagent。

---

## 主流程（Main Agent）

### Step 0 — 依赖检查（前置闸门）

派发任何 subagent 前，先确认 `diagnose-and-fix` skill 已装载（在可用 skill 列表中）。**未装载则立即停止**，不解析队列、不进入 subagent：

```
❌ 本 skill 依赖 diagnose-and-fix skill，但未检测到它已装载。
请先装载 diagnose-and-fix（见 README「使用」）后重试。
```

确认存在后再进入 Step 1。

### Step 1 — 解析问题队列

**未提供编号：** 扫描文件，按格式排除已修复条目：
- JSON/YAML：`status` 字段值为 `resolved/fixed/done/closed`（忽略大小写）
- Markdown/纯文本：含 `status: resolved`、`[resolved`、`✅ 修复记录`，或 `fixed/done/closed` 紧跟编号后

未命中者视为未修复，输出清单后**停止，等待用户选择**：

```
🔍 发现 N 个未修复问题：

| # | 编号 | 标题 | 严重程度 | 分类 |
|---|------|------|----------|------|
| 1 | #<编号> | <标题> | <如有> | <如有> |

处理方式： a) 按序逐个修复  b) 指定编号（空格分隔）  c) 取消
请选择：
```

（无 severity/type 字段时省略对应列）

- `a` → 全部按序入队
- `b` → 停止，等待用户输入编号列表后入队
- `c` → 停止

**提供编号：** 验证各编号存在，无效的跳过并提示，其余按输入顺序入队。

队列确定后输出确认表格，并询问处理模式（**所有路径都问一次**）：

```
📌 待处理队列（共 N 个）：

| 顺序 | 编号 | 标题 |
|------|------|------|
| 1 | #<编号> | <标题> |

处理模式： 1) 连续处理（subagent 之间不停）  2) 逐个确认（每个 subagent 结束后停下）
请选择（默认 1）：
```

> 默认连续：用户在每个 subagent 内部已全程参与（选方案、测试失败、提交确认），subagent 之间再加 y/n 是重复摩擦。需中途审视节奏时才选「逐个确认」。

### Step 2 — 循环派发 Subagent

按序串行启动 Subagent，注入以下 prompt：

```
你是问题修复 agent，拥有完整工具权限，可与用户交互。

调用 diagnose-and-fix skill 处理下面这个问题，参数为：<问题列表文件> <编号>
该 skill 会完成单问题全流程：诊断 → 用户选方案 → 修复 → 测试 → 修复后验证 →
提交代码 → 在问题列表内标记 resolved（只标记、不提交列表）。全程交互由该 skill 主导，
你不要另起一套修复流程，也不要重复标记列表。

问题列表文件：<路径>
当前问题编号：<编号>
队列进度：[M/N]
问题内容：
<条目原文>

diagnose-and-fix 收束后，读取它给出的【终态】，按下表映射并返回 RESULT：

| diagnose-and-fix 终态 | status            | 说明 |
|----------------------|-------------------|------|
| completed            | completed         | 已修复并提交代码、列表已标记 resolved |
| skipped_inconsistent | skipped_inconsistent | 描述与代码对不上，用户确认跳过 |
| skipped_noop         | skipped_noop      | 问题已缓解/无需修复，列表标记 no-op |
| user_declined        | user_declined     | 用户选「仅报告，暂不修复」 |
| skipped_test_failed  | skipped_test_failed  | 测试/验证重试超 3 次 |

RESULT 格式（严格按此返回，供主 agent 解析）：

RESULT #<编号>
status: <见上表>
solution: <方案名> | no-op: <原因> | —
code_commit: <hash7> | none | —
list_marked: resolved | no-op | not-marked
```

Subagent 返回 `RESULT` 后，追加进度行（首条先输出表头）：

```
| 状态 | 编号 | 标题 | 方案 | code commit |
|------|------|------|------|-------------|
| ✅/⚠️/❌/⏭️/🔵 | #<编号> | <标题> | <方案名/—> | <hash7/none/—> |
```

- **连续处理** → 直接启动下一个。
- **逐个确认** → 队列还有下一个时**停止，等待用户输入** `继续处理下一个 #<编号>：<标题>？(y/n)`；`y` 启动下一个，`n` 进入 Step 3。

队列处理完进入 Step 3。

### Step 3 — 收尾摘要

不提交问题列表，直接输出最终摘要：

```
🏁 本次共处理 N 个问题（问题列表已标记 resolved、未提交）：

| 状态 | 编号 | 标题 | 方案 | code commit |
|------|------|------|------|-------------|
| ✅ 已完成       | ... | ... | <方案名>    | <hash7> |
| 🔵 无需修复     | ... | ... | <no-op原因> | none    |
| ⚠️ 存疑跳过     | ... | ... | —           | —       |
| ❌ 测试/验证失败 | ... | ... | <方案名>    | —       |
| ⏭️ 用户跳过     | ... | ... | —           | —       |
```

---

## 错误处理

本表只列**编排器级**异常；单问题流程内的失败（测试/验证超限、git 未初始化、格式化工具缺失、列表只读、工作区有无关改动等）由 `diagnose-and-fix` skill 自行处理并反映在终态里。

| 情况 | 处理 |
|------|------|
| 文件不存在 | Main Agent 报错停止 |
| 编号未找到 | 跳过，继续队列，列出可用编号 |
| 无未修复问题 | 提示「所有问题已修复」后停止 |
| `diagnose-and-fix` skill 未装载 | Step 0 前置拦截：提示用户装载该依赖后停止，不进入 subagent |
| subagent 返回非 `completed` 终态 | 按终态记入进度表/摘要（`skipped_*`/`user_declined`），继续队列 |
| subagent 崩溃 / 未返回 RESULT / RESULT 缺失字段或无法解析 | 记为 ❌ 失败（status 留空、方案与 commit 填 `—`），继续队列，并在摘要提示该 `#<编号>` 需手动复核 |
