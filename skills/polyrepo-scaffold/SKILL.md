---
name: polyrepo-scaffold
description: Use when initializing a new multi-repo (polyrepo) workspace, or adding web / server / client / custom modules to an existing one. Sets up the spec-center SSOT plus per-module repos with shared AGENTS.md conventions via a zero-dependency Node script.
allowed-tools: Bash, Read, AskUserQuestion
---

# Polyrepo Scaffold

> 偶发的结构性操作:搭建多仓工作区或向其中新增模块。所有确定性产物——拷模板、`{{PROJECT}}` 替换、`git init`,以及 `spec-center/AGENTS.md` 的 Module Map 表与 Repository Structure 树——全部由零依赖脚本 `scripts/scaffold.mjs` 完成,以工作区实际存在的模块目录为单一真相,幂等。Claude 只负责:意图判定、收集输入、确认计划、调脚本、(失败时)处理残留、转述输出——不手工编辑生成产物。

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
3. **调脚本**(确认后):见 §5。脚本会自动生成 `spec-center/AGENTS.md` 的模块表与目录树,无需 Claude 介入。
4. **汇报**:转述脚本输出的 `created:` / `skipped:` 行;若出现 `partial:` 段(中途失败),按 §6 处理残留。完成后提示后续开发流程见 `<project>-spec-center/AGENTS.md`(含 spec-first 工作流)。

## 3. Add 工作流

1. **确认上下文**:工作区目录 `dir`。项目前缀 `name` **可省略**——脚本会从 `dir` 下唯一的 `<name>-spec-center/` 自动推断;Claude 可先 `ls` 工作区,把推断出的 `name` 报给用户确认。目录下有多个 `*-spec-center` 时脚本会报错,须显式传 `--name`。
2. **收集新模块** `modules`:已存在的模块、`spec-center` 会被脚本自动跳过并在汇总里标注 `skipped`。
3. **展示计划表并确认**。
4. **调脚本**(确认后):见 §5。脚本会按工作区实际模块自动把新模块并入 `spec-center/AGENTS.md` 的表与树。
5. **汇报**:转述 `added:` / `skipped:` 行;若出现 `partial:` 段,按 §6 处理残留。

## 4. 模块模板对照

| 模板 | 用途 |
|---|---|
| `spec-center` | SSOT:跨模块契约 / 约定 / 错误码 / API。**init 始终包含,不可省略;add 不重复创建。** |
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
  [--name <project>] \     # 可选;省略时从 dir 下唯一的 <name>-spec-center 推断
  --dir <path> \           # 含 <project>-spec-center 的工作区目录
  --modules <list> \       # 已存在 / spec-center 会被自动跳过
  [--no-git] [--dry-run]
```

- `--dry-run`:只打印计划,不落盘。建议先 dry-run 给用户看,确认后再正式执行。
- `--no-git`:跳过 git 初始化。
- `node scripts/scaffold.mjs --help`:查看用法。

脚本路径相对本 skill 目录;调用时用脚本的绝对/正确相对路径。

## 6. `spec-center/AGENTS.md` 由脚本维护 + 失败残留处理

**结构生成全由脚本完成,Claude 不手工编辑。** 脚本在 init/add 末尾,按工作区实际存在的 `<project>-<module>/` 目录,重写 `spec-center/AGENTS.md` 里两处锚点区块(`<!-- MODULE_MAP_START/END -->`、`<!-- REPO_TREE_START/END -->`):Module Map 角色取自各模块自身 `AGENTS.md` 的 `## Role`,目录树连接线由结构计算。这是幂等操作——init/add/重跑结果一致,不依赖解析旧内容。**不要手动改这两个区块之间的内容**(锚点是 HTML 注释,不渲染)。

模块的语义留空块(各模块 `AGENTS.md` 的 Key Responsibilities / Tech Stack、spec-center 的 Core Domain Concepts 等)属于后续开发,不是 scaffold 职责,按需在开发中填。

**失败残留处理(脚本非原子)**:脚本中途失败时会在 stderr 打印:

```
partial: created before failure (not rolled back):
  <path1>
  <path2>
```

Claude 须读出这些路径,用 `AskUserQuestion` 问用户是否删除,确认后再删:

- **init 失败**:列出的第一个路径通常是整个工作区目录(init 前已校验为空/不存在),可整体删除后重来。
- **add 失败**:只列出本次新建的模块目录——**只删这些,绝不动既有模块**。

用户选择保留时,原样留下,提示其手工检查。

## 7. Git 行为

每个新建模块只执行 `git init` + `git branch -M main`,**不** `git add`、**不** commit——交给用户自行首次提交。`--no-git` 时整段跳过。

## 8. 后续与相关 skill

- **开发流程**:工作区建好后,spec-first 工作流(spec 划分/所有权、跨模块 plan 拆分、spec 索引维护)见生成的 `<project>-spec-center/AGENTS.md`——该模板内含 SDD 方法论,运行时直接承载,无需独立 skill。
- `code-conventions`:横切规范文档体系。模板留空 `conventions/` 目录——通用规范运行时引用本 skill,不落地;`conventions/` 仅承载项目私有规范。
- `engineering-guidelines`:LLM/agent 编码行为准则。
