# SKILLS

一组可独立装载的 **Agent / Claude Code Skills**，覆盖从「行为准则 → 规范 → 流程 → 工程脚手架 → 代码审计」的完整链路。每个 skill 自包含、可单独启用，彼此**只做 skill 级引用，不做内容级引用**。

## Skills 一览

| Skill | 性质 | 触发时机 | 作用 |
|---|---|---|---|
| [`engineering-guidelines`](skills/engineering-guidelines/) | 行为准则 | 每次写/改代码前 | LLM/agent 编码行为：think-before-coding、simplicity-first、surgical-changes、goal-driven、root-cause reasoning |
| [`code-conventions`](skills/code-conventions/) | 规范索引 + 文档库 | 写码时按需 | 横切规范的统一入口：HTTP API、可观测性、测试、提交信息、错误码，以及 Go 专项规范（`references/`） |
| [`agents-scaffold`](skills/agents-scaffold/) | 结构性操作 | 偶发、一次性 | 零依赖脚本搭建多仓工作区（`spec-center` SSOT + 各模块仓）或原地初始化单个独立仓库，并产出含 spec-first/SDD 工作流的 `AGENTS.md` |
| [`codebase-audit`](skills/codebase-audit/) | 多 agent 审计 | 手动 `@codebase-audit`（偶发、一次性） | 多 agent 并行审计代码库（架构/代码质量/安全/测试/依赖/可维护性/规范符合性），对抗式验证去伪后汇总单一报告；附带 `ultracode` 走 Workflow 确定性编排，否则自动降级到 Agent 并行 |
| [`diagnose-and-fix`](skills/diagnose-and-fix/) | 单问题诊断修复 | 自动按场景 / 手动 `@diagnose-and-fix` | 「理解优先于修改」：先侦察项目、追踪代码、验证问题真实存在，产出结构化诊断报告，用户选定方案后再修复→测试→修复后验证→提交。输入为问题列表时只标记 resolved、不提交 |
| [`diagnose-and-fix-batch`](skills/diagnose-and-fix-batch/) | 批量循环修复 | 手动 `@diagnose-and-fix-batch <问题列表文件>`（按需） | 把问题列表排成队列，逐个派发独立 subagent，每个 subagent 调用 `diagnose-and-fix` skill 完成单问题全流程，再回收终态汇总；问题列表只标记 resolved、不提交（提交时机由用户掌控）。**强依赖 `diagnose-and-fix` skill** |

## Skill 之间的关系

```
engineering-guidelines   code-conventions
        （行为）           （规范）
            \                /
             \               /
              └─ agents-scaffold ─┘
   （搭出工作区骨架；spec-first/SDD 流程由其生成的
    spec-center/AGENTS.md 直接承载，不单列 skill）

  codebase-audit  ——  手动 @codebase-audit；可对任意代码库
                       做多维度审计；规范符合性维度运行时按需
                       加载 code-conventions 作基准（缺失则降级）

  diagnose-and-fix  ◀────────  diagnose-and-fix-batch
   （单问题诊断修复）   强依赖      （批量循环修复）
   自动按场景/手动              手动；把问题列表排成队列，逐个派
   @diagnose-and-fix          subagent 调用 diagnose-and-fix 处理
                              单问题。二者都只标记 resolved、不提交
                              列表，提交时机交用户掌控
```

设计原则：

- **独立性优先**：每个 skill 可单独启用，不依赖其它 skill 的内部文件。
- **只做 skill 级引用**：需要关联时只提对方的 **skill 名**（如「见 `code-conventions` skill」），绝不链入对方目录里的具体文件路径。
- **正交而非合并**：`agents-scaffold`（偶发结构操作）与 `code-conventions`（写码时高频引用）正交，各自独立；而 spec-first/SDD 工作流全程依赖 polyrepo 结构，属于配套能力，已并入 `agents-scaffold` 的 `spec-center/AGENTS.md` 模板，不单列。
- `codebase-audit` 设 `disable-model-invocation: true`，仅手动 `@codebase-audit` 触发，可对任意代码库独立运行。其「规范符合性」维度会在运行时按需加载 `code-conventions` skill 作为审计基准（skill 级引用，不链入对方目录文件）；该 skill 缺失时此维度优雅降级、其余维度照常，故独立性不受影响。
- `agents-scaffold` 产出的工作区里 `spec-center/conventions/` **初始为空**：通用规范运行时引用 `code-conventions` skill，不落地副本；`conventions/` 仅承载项目私有规范。
- `diagnose-and-fix` 聚焦**单个**问题的诊断优先修复，可由 agent 按场景自动触发，也可手动 `@diagnose-and-fix`；`diagnose-and-fix-batch` 设 `disable-model-invocation: true` 仅手动触发，把一个**问题列表**排队循环修复，**各问题在独立 subagent 中调用 `diagnose-and-fix` skill 处理**——故 batch **强依赖** `diagnose-and-fix`（按 skill 名调用、不链入对方目录文件，仍属 skill 级引用）。两者均只在文件内标记 resolved、**不提交**问题列表（提交时机交用户掌控）。

## 使用

### 方式一：`npx skills add`（推荐）

无需克隆本仓，直接在目标项目目录下运行，即可从远程仓库装载指定 skill：

```bash
npx skills add https://github.com/0xkangl/skills --skill <skill-name>
```

将 `<skill-name>` 替换为上方「Skills 一览」表中的 skill 目录名（如 `engineering-guidelines`、`code-conventions`、`agents-scaffold` 等）。可多次执行以装载多个 skill。

### 方式二：本地软链

克隆本仓后，把需要的 skill 软链入 Claude Code 的 skills 目录（全局或项目级）：

```bash
# 全局（对所有项目可用）
ln -s "$PWD/skills/<skill-name>" ~/.claude/skills/<skill-name>

# 或项目级
ln -s "$PWD/skills/<skill-name>" <project>/.claude/skills/<skill-name>
```

装载后，agent 会依据各 skill `SKILL.md` frontmatter 里的 `description` 自动按场景匹配触发。

各 skill 的具体用法以其目录内的文档为准（如 `agents-scaffold` 的脚本快速上手与测试见 [`skills/agents-scaffold/README.md`](skills/agents-scaffold/README.md)）。

## 目录结构

```
skills/
├── README.md                       # 本文件
├── AGENTS.md                       # 在本仓工作的 agent 须知
├── CLAUDE.md                       # → AGENTS.md
└── skills/
    ├── engineering-guidelines/     # SKILL.md
    ├── code-conventions/           # SKILL.md + references/（含 golang/）
    ├── agents-scaffold/          # SKILL.md + README.md + scripts/ + templates/
    ├── codebase-audit/             # SKILL.md + agents/（各维度审计指令）
    ├── diagnose-and-fix/           # SKILL.md
    └── diagnose-and-fix-batch/     # SKILL.md
```
