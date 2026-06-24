# skills-repo

一组可独立装载的 **Agent / Claude Code Skills**，覆盖从「行为准则 → 规范 → 流程 → 工程脚手架」的完整链路。每个 skill 自包含、可单独启用，彼此**只做 skill 级引用，不做内容级引用**。

## Skills 一览

| Skill | 性质 | 触发时机 | 作用 |
|---|---|---|---|
| [`engineering-guidelines`](skills/engineering-guidelines/) | 行为准则 | 每次写/改代码前 | LLM/agent 编码行为：think-before-coding、simplicity-first、surgical-changes、goal-driven、root-cause reasoning |
| [`code-conventions`](skills/code-conventions/) | 规范索引 + 文档库 | 写码时按需 | 横切规范的统一入口：HTTP API、可观测性、测试、提交信息、错误码，以及 Go 专项规范（`references/`） |
| [`spec-driven-development`](skills/spec-driven-development/) | 流程纪律 | 每次改动前 | spec-first 流程：先写/批准 spec、共享 vs 模块 spec 归属、跨模块 plan 拆分、spec 索引维护 |
| [`polyrepo-scaffold`](skills/polyrepo-scaffold/) | 结构性操作 | 偶发、一次性 | 零依赖脚本搭建多仓工作区（`spec-center` SSOT + 各模块仓） |

## Skill 之间的关系

```
engineering-guidelines   code-conventions   spec-driven-development
        （行为）              （规范）              （流程）
            \                   |                    /
             \                  |                   /
              └──────── polyrepo-scaffold ─────────┘
                  （搭出承载上述三者的工作区骨架）
```

设计原则：

- **独立性优先**：每个 skill 可单独启用，不依赖其它 skill 的内部文件。
- **只做 skill 级引用**：需要关联时只提对方的 **skill 名**（如「见 `code-conventions` skill」），绝不链入对方目录里的具体文件路径。
- **正交而非合并**：`polyrepo-scaffold` 是偶发的一次性结构操作；`spec-driven-development` 是每次改动的高频纪律。两者生命周期相反，保持独立，不合并。
- `polyrepo-scaffold` 产出的工作区里 `spec-center/conventions/` **初始为空**，由团队按 `code-conventions` skill 逐步填充——脚手架不内联规范副本，避免重复与耦合。

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
    ├── spec-driven-development/    # SKILL.md
    └── polyrepo-scaffold/          # SKILL.md + scripts/ + templates/
```
