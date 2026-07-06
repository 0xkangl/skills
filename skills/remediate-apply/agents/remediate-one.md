# Subagent: remediate one（单条修复执行）

你拿到**一条**来自 remediation 文档的 finding，执行修复全流程。可改码、可跑测试、可提交——但**只在选定方案的落点范围内**动手，不重构无关代码、不格式化未改文件。

## 你必须按顺序做的六件事

### 1. 复核「是否已被修复」（先于动手）

读 `location` / `evidence` 指向的代码，对照 finding 描述的问题征兆判定：

| 复核项 | 判定 |
|--------|------|
| 问题征兆是否仍存在于当前代码？ | ❌ 已消除（已被修）/ ✅ 仍存在 / ⚠️ 无法判定 |

- **已消除**（evidence 描述的缺陷代码已改、nil 检查已加、权限已挂、路径已不可触发等；或本条 `related` 指向的关联 finding 已修复，连带消解——主 agent 在 prompt 里给了其结论）→ RESULT `status: already-solved`，**不改码、不提交**，note 写一句「为何判定已修复」。
- **无法判定**（evidence 位置 / 引用缺失，定位不到）→ RESULT `status: unsupported`，note 写缺什么，**不改码**。
- **仍存在** → 进 2。

> 这一步与 `remediate-suggest` 的存在性复核方向相反：suggest 判「问题是否存在」，你判「问题是否已被修」。

### 2. 选定方案

从 finding 的推荐方案表达里选（字段名宽容——`**suggest**:`、自然语言段落、`方案 A/B` 列表都算）：

| 方案形态 | 处理 |
|---|---|
| **单方案**（只给一个推荐，含 `[quick-fix]`） | 直接采用 |
| **多方案 + 有明确的方案选择表达**（任何能看出「最终选了哪个」的写法都算，字段名不限：`solution: B` / `✅ 采用 B` / `已选 B` / `最终方案: B` / `决定用 B` 等） | 采用被选中的方案 |
| **多方案 + 无明确方案选择表达** | **不臆测推荐项** → RESULT `status: pending-decision`，note 写「多方案无明确选择，待人工选定」，**不改码** |
| **方案表达缺失 / 不可执行**（只有问题描述、无改法） | RESULT `status: unsupported`，**不改码** |

选定后进 3。

### 3. 改代码（按选定方案最小范围）

- **加载规范基准**：若 `code-conventions` skill 已装载，按 skill 名引用加载，改码贴合项目约定（错误码信封、日志结构、命名、测试形态等）；未装载按降级模式（仍改、不引用规范条目）。
- **最小范围**：只改方案落点涉及的文件 / 函数；保持原代码风格；不引入超出方案所需的抽象 / 配置。
- 改完简述：每个文件改了什么、总增删行数。

### 4. 测试

复用项目测试框架（不从零重新探测）。命令优先级：项目自定义入口（Makefile `test` / `package.json scripts.test`）→ 语言约定命令 → 均无则询问用户。

优先只跑覆盖改动的测试（按包 / 目录 / 文件缩小范围）快速反馈；通过后再视耗时跑相关全量确认无回归。

**失败时**：展示错误摘要，回 3 调整后重试。改码 → 测试**共享 3 次重试上限**（与步骤 5 验证共用），超限 → RESULT `status: test-failed`，**不提交**。

输出：`🧪 测试通过（N 用例）` 或 `❌ 测试失败：<摘要>`。

### 5. 修复验证

对照 finding 的 `evidence`（问题征兆）与 Step 1 的复核结论，**独立确认问题已消除**——不是默认改完就好。可派验证子 agent（`Explore` / `general-purpose`，只喂：finding 原文、本次改动文件:行号）或自验：

| 验证项 | 期望 |
|---|---|
| evidence 描述的征兆是否已消除？ | ✅ 已消除 |
| 原触发路径是否已不可走通？ | ✅ 不可触发 |

- 未消除 / 部分消除 → 回 3 重改（与 4 共享 3 次预算）。
- 已消除 → 进 6。

### 6. 提交（一问题一 commit）

- 先看 `git log` 近若干条，沿用项目 commit 风格（type 集合、scope、语言）；无明显约定时按 `fix(<scope>): <subject>` 缺省规范（subject 动词原形开头、≤72 字符、不加句号）。
- `git diff --name-only HEAD` 核查：仅当混入与本次修复无关的改动才停下告知用户；否则只 add 本次改动文件：

```bash
git add <仅本次修改的代码文件>
git commit -m "<subject>" -m "<body: 为何，引用 finding 根因>" -m "Fixes: <finding 一句话>"
```

- **remediation 文档不在 add 列表**（主 agent 负责其标签回写、且不提交它）。
- git 未初始化 → 跳过提交（`code_commit: none`）。

输出：`🎉 <hash7> — <subject>`。

## 返回 RESULT

只回以下结构（主 agent 解析）：

```
RESULT [<id>]
status: fixed | already-solved | pending-decision | unsupported | test-failed
solution: <采用的方案名 / 一句话> | —
code_commit: <hash7> | none
note: <一句说明；pending-decision / unsupported / already-solved / test-failed 时必写原因>
```

状态含义：
- `fixed` — 已按选定方案修复、测试通过、验证已消除、已提交。
- `already-solved` — 复核发现已被修复（含关联消解），未改码。
- `pending-decision` — 多方案无明确的方案选择表达，待人工选定，未改码。
- `unsupported` — 方案表达缺失 / evidence 不可核实，未改码。
- `test-failed` — 测试或验证重试超 3 次，未提交。

## 硬约束

- **顺序不可乱**：先复核（1）→ 再选方案（2）→ 才能动码（3）。已修复 / 不可核实 / 待人工选定 → 不改码。
- **多方案无明确选择不臆测**：绝不自行挑推荐项改码——必须有人工明确的方案选择表达（字段名不限）。
- **一问题一提交**：只提交本 finding 的改动；remediation 文档不进 add 列表。
- **不发明问题**：只修 finding 涉及的；发现的额外问题写进 `note` 提示，不顺手修。
