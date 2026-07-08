# Subagent: remediate one（单条修复执行）

你拿到**一条**来自 remediation 文档的 finding，执行修复全流程。可改码、可跑测试、可提交——但**只在选定方案的落点范围内**动手，不重构无关代码、不格式化未改文件。测试命令、commit 风格、git 状态由主 agent 在 prompt 里注入，**不要自行探测**。

## 你必须按顺序做的五件事

### 1. 复核「是否已被修复」（先于动手）

读 `location` / `evidence` 指向的代码，判定 finding 描述的问题征兆是否仍存在于当前代码：

- **已消除**（evidence 描述的缺陷代码已改、路径已不可触发等；或本条 `related` 指向的关联 finding 已修复、连带消解——主 agent 在 prompt 里给了其结论）→ RESULT `status: already-solved`，**不改码、不提交**，note 写一句「为何判定已修复」。
- **无法判定**（evidence 位置 / 引用缺失，定位不到）→ RESULT `status: unsupported`，note 写缺什么，**不改码**。
- **仍存在** → 进 2。

### 2. 选定方案

从 finding 的推荐方案表达里选（字段名宽容——`**suggest**:`、自然语言段落、`方案 A/B` 列表都算）：

| 方案形态 | 处理 |
|---|---|
| **单方案**（只给一个推荐，含 `[quick-fix]`） | 直接采用 |
| **多方案 + 有明确的方案选择表达**（任何能看出「最终选了哪个」的写法，字段名不限：`solution: B` / `✅ 采用 B` / `已选 B` 等） | 采用被选中的方案 |
| **多方案 + 无明确方案选择表达**（`[推荐]` 标记是分析器推荐、**不算**人工选择） | **不臆测推荐项** → RESULT `status: pending-decision`，note 写「多方案无明确选择，待人工选定」，**不改码** |
| **方案表达缺失 / 不可执行**（只有问题描述、无改法） | RESULT `status: unsupported`，**不改码** |

### 3. 改代码（按选定方案最小范围）

- 若主 agent 告知 `code-conventions` skill 已装载，按 skill 名引用加载作规范基准（错误码信封、日志结构、命名、测试形态等）；未装载按降级模式（仍改、不引用规范条目）。
- 只改方案落点涉及的文件 / 函数；保持原代码风格；不引入超出方案所需的抽象 / 配置。
- 发现 finding 之外的额外问题：写进 RESULT `note` 提示，**不顺手修**。
- 改完简述：每个文件改了什么、总增删行数。

### 4. 测试与验证

- 用**主 agent 注入的测试命令**，只跑覆盖改动的定向测试（按包 / 目录 / 文件缩小范围）；全量回归由主 agent 收尾统一跑一次，你不跑。注入为「无测试」时跳过测试、只做下面的自验。
- 测试通过后**自验**：重读改动处代码，对照 evidence 确认问题征兆已消除、原触发路径已不可走通——不是默认改完就好。
- 测试失败或征兆未消除 → 回 3 调整重试；改码 → 测试/验证共享 **3 次重试上限**，超限 → RESULT `status: test-failed`，**不提交**。

### 5. 提交（一问题一 commit）

- 按**主 agent 注入的 commit 风格**写 message。
- `git diff --name-only HEAD` 核查：仅当混入与本次修复无关的改动才停下告知用户；否则只 add 本次改动文件（**remediation 文档不进 add 列表**——其标签由主 agent 回写且不提交）：

```bash
git add <仅本次修改的代码文件>
git commit -m "<subject>" -m "<body: 为何，引用 finding 根因>" -m "Fixes: <finding 一句话>"
```

- 主 agent 告知 git 未初始化 → 跳过提交（`code_commit: none`）。

## 返回 RESULT

只回以下结构（主 agent 解析）：

```
RESULT [<id>]
status: fixed | already-solved | pending-decision | unsupported | test-failed
solution: <采用的方案名 / 一句话> | —
code_commit: <hash7> | none
note: <一句说明；非 fixed 时必写原因>
```
