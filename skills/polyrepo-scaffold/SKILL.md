---
name: polyrepo-scaffold
description: Use when initializing a new multi-repo (polyrepo) workspace, or adding web / server / client / custom modules to an existing one. Sets up the spec-center SSOT plus per-module repos with shared AGENTS.md conventions via a zero-dependency Node script.
---

# Polyrepo Scaffold

> 偶发的结构性操作:搭建多仓工作区或向其中新增模块。机械逻辑全部由零依赖脚本 `scripts/scaffold.mjs` 确定性执行,Claude 只负责意图判定、收集输入、确认计划、调脚本、转述输出。

## 1. 两种模式(无自动检测)

按用户意图明确选择,不自动探测:

- **init**:从零创建一个新工作区(包含 `spec-center` + 所选模块)。
- **add**:向已有工作区(已含 `<project>-spec-center/`)新增模块。

不确定是哪种时,直接问用户:「是新建工作区,还是往已有工作区加模块?」

## 2. Init 工作流

1. **收集输入**:
   - 项目名 `name`(kebab-case;可按需求替用户推荐一个)。
   - 工作区目录 `dir`(默认 `./<name>`;必须为空或不存在)。
   - 模块列表 `modules`:逗号分隔。`spec-center` 始终包含,无需用户指定。
2. **展示计划表并确认**:列出将创建的目录(`<name>-spec-center` + 各模块)、是否建 git,等用户确认。
3. **调脚本**(确认后):见 §5。
4. **汇报**:转述脚本输出的 `created:` / `skipped:` 行,并提示后续用 `spec-driven-development`。

## 3. Add 工作流

1. **确认上下文**:工作区目录 `dir` 与项目前缀 `name`(目录下应有 `<name>-spec-center/`)。
2. **收集新模块** `modules`:已存在的模块、`spec-center` 会被脚本自动跳过并在汇总里标注 `skipped`。
3. **展示计划表并确认**。
4. **调脚本**(确认后):见 §5。
5. **汇报**:转述 `added:` / `skipped:` 行。

## 4. 模块模板对照

| 模板 | 用途 |
|---|---|
| `spec-center` | SSOT:跨模块契约 / 约定 / 错误码 / API。**init 始终包含,不可省略;add 不再创建。** |
| `server` | 后端服务 |
| `web` | Web 应用 |
| `client` | 移动端 / 客户端应用 |

**模块语法**:`name`(内建模板,名即模板名)或 `name=template`(用 `template` 模板生成自定义名模块,如 `api-gateway=server`、`mobile=client`)。同一模板可多次生成不同名模块。

## 5. 脚本调用参考

脚本非交互,全部参数经 flag 传入:

```bash
# 初始化
node scripts/scaffold.mjs init \
  --name <project> \
  --dir <path> \           # 可选,默认 ./<project>;必须为空或不存在
  --modules <list> \       # 如 server,web 或 api-gateway=server,user-service=server
  [--no-git] [--dry-run]

# 向已有工作区添加
node scripts/scaffold.mjs add \
  --name <project> \       # 已有项目前缀
  --dir <path> \           # 含 <project>-spec-center 的工作区目录
  --modules <list> \       # 已存在 / spec-center 会被自动跳过
  [--no-git] [--dry-run]
```

- `--dry-run`:只打印计划,不落盘。建议先 dry-run 给用户看,确认后再正式执行。
- `--no-git`:跳过 git 初始化。
- `node scripts/scaffold.mjs --help`:查看用法。

脚本路径相对本 skill 目录;调用时用脚本的绝对/正确相对路径。

## 6. Git 行为

每个新建模块只执行 `git init` + `git branch -M main`,**不** `git add`、**不** commit——交给用户自行首次提交。`--no-git` 时整段跳过。

## 7. 相关 skill

- `spec-driven-development`:工作区建好后,每次改动都从 spec 出发(高频纪律,与本 skill 正交)。
- `project-conventions`:模板内置的约定文档体系。
- `engineering-guidelines`:LLM/agent 编码行为准则。
