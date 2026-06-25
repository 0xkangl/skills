# skills-repo

一组可独立装载的 **Agent / Claude Code Skills**，覆盖从「行为准则 → 规范 → 流程 → 工程脚手架 → 代码审计」的完整链路。每个 skill 自包含、可单独启用，彼此**只做 skill 级引用，不做内容级引用**。

## Skills 一览

| Skill | 性质 | 触发时机 | 作用 |
|---|---|---|---|
| [`engineering-guidelines`](skills/engineering-guidelines/) | 行为准则 | 每次写/改代码前 | LLM/agent 编码行为：think-before-coding、simplicity-first、surgical-changes、goal-driven、root-cause reasoning |
| [`code-conventions`](skills/code-conventions/) | 规范索引 + 文档库 | 写码时按需 | 横切规范的统一入口：HTTP API、可观测性、测试、提交信息、错误码，以及 Go 专项规范（`references/`） |
| [`polyrepo-scaffold`](skills/polyrepo-scaffold/) | 结构性操作 | 偶发、一次性 | 零依赖脚本搭建多仓工作区（`spec-center` SSOT + 各模块仓），并产出含 spec-first/SDD 工作流的 `spec-center/AGENTS.md` |
| [`codebase-audit`](skills/codebase-audit/) | 多 agent 审计 | 手动 `@codebase-audit`（偶发、一次性） | 多 agent 并行审计代码库（架构/代码质量/安全/测试/依赖/可维护性），对抗式验证去伪后汇总单一报告 |

## Skill 之间的关系

```
engineering-guidelines   code-conventions
        （行为）           （规范）
            \                /
             \               /
              └─ polyrepo-scaffold ─┘
   （搭出工作区骨架；spec-first/SDD 流程由其生成的
    spec-center/AGENTS.md 直接承载，不单列 skill）

  codebase-audit  ——  手动 @codebase-audit；独立，
                       可对任意代码库做多维度审计
```

设计原则：

- **独立性优先**：每个 skill 可单独启用，不依赖其它 skill 的内部文件。
- **只做 skill 级引用**：需要关联时只提对方的 **skill 名**（如「见 `code-conventions` skill」），绝不链入对方目录里的具体文件路径。
- **正交而非合并**：`polyrepo-scaffold`（偶发结构操作）与 `code-conventions`（写码时高频引用）正交，各自独立；而 spec-first/SDD 工作流全程依赖 polyrepo 结构，属于配套能力，已并入 `polyrepo-scaffold` 的 `spec-center/AGENTS.md` 模板，不单列。
- `codebase-audit` 设 `disable-model-invocation: true`，仅手动 `@codebase-audit` 触发，与写码类 skill 正交——可对任意代码库独立运行，不依赖其它 skill。
- `polyrepo-scaffold` 产出的工作区里 `spec-center/conventions/` **初始为空**：通用规范运行时引用 `code-conventions` skill，不落地副本；`conventions/` 仅承载项目私有规范。

## 使用

把需要的 skill 装入 Claude Code 的 skills 目录（全局或项目级）：

```bash
# 全局（对所有项目可用）
ln -s "$PWD/skills/<skill-name>" ~/.claude/skills/<skill-name>

# 或项目级
ln -s "$PWD/skills/<skill-name>" <project>/.claude/skills/<skill-name>
```

装载后，agent 会依据各 skill `SKILL.md` frontmatter 里的 `description` 自动按场景匹配触发。

### polyrepo-scaffold 快速上手

```bash
cd skills/polyrepo-scaffold

# 预览计划（不落盘）
node scripts/scaffold.mjs init --name myapp --modules server,web --dry-run

# 正式初始化：生成 myapp-spec-center + myapp-server + myapp-web
node scripts/scaffold.mjs init --name myapp --modules server,web

# 向已有工作区新增模块（支持 name=template 自定义命名）
node scripts/scaffold.mjs add --name myapp --dir ./myapp --modules api-gateway=server
```

## 开发与测试

`polyrepo-scaffold` 的脚本是零依赖 Node（仅 `node:` 内置模块），用内置 test runner 跑：

```bash
cd skills/polyrepo-scaffold
node --test scripts/scaffold.test.mjs
```

## 目录结构

```
skills-repo/
├── README.md                       # 本文件
├── AGENTS.md                       # 在本仓工作的 agent 须知
├── CLAUDE.md                       # → AGENTS.md
└── skills/
    ├── engineering-guidelines/     # SKILL.md
    ├── code-conventions/           # SKILL.md + references/（含 golang/）
    ├── polyrepo-scaffold/          # SKILL.md + scripts/ + templates/
    └── codebase-audit/             # SKILL.md + agents/（各维度审计指令）
```
