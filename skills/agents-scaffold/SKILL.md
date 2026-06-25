---
name: agents-scaffold
disable-model-invocation: true
description: Scaffolds a multi-repo (polyrepo) workspace, adds web / server / client / custom modules to an existing one, or initializes a standalone single-repo project in place from one template. Sets up the spec-center SSOT plus per-module repos (or a single repo's in-repo specs/contracts) with shared AGENTS.md conventions via a zero-dependency Node script.
allowed-tools: Bash, Read, AskUserQuestion
---

# Agents Scaffold

> 偶发的结构性操作:搭建多仓工作区、向其中新增模块,或原地初始化单个独立仓库。所有确定性产物——拷模板、`{{PROJECT}}` 替换、`git init`,以及 `spec-center/AGENTS.md` 的 Module Map 表与 Repository Structure 树——全部由零依赖脚本 `scripts/scaffold.mjs` 完成,以工作区实际存在的模块目录为单一真相,幂等。Claude 只负责:意图判定、收集输入、确认计划、调脚本、(失败时)处理残留、转述输出——不手工编辑生成产物。

## 1. 三种模式(无自动检测)

按用户意图明确选择,不自动探测:

- **workspace**:从零创建一个新**多仓工作区**(包含 `spec-center` + 所选模块,每个模块落在 `<project>-<module>/` 子目录)。
- **module**:向已有工作区(已含 `<project>-spec-center/`)新增模块。
- **single**:**单仓库**——在目标目录**原地**用单个模板初始化一个独立项目(非子模块、无 spec-center)。

**初始化意图必须先确认模式(硬规则)**:「初始化/搭建/新建一个项目」这类措辞**天然区分不了** workspace(多仓工作区)还是 single(单仓库)——例如「初始化 server 项目」里 `server` 只表明所选模板,并不表明仓库形态。**除非用户已明确表态**(如「多仓工作区 / 微服务 / 拆成多个仓」对应 workspace,「单仓库 / 单个仓库 / monorepo / 不要 spec-center / 在当前目录就地建」对应 single),否则在调脚本前**必须**用 `AskUserQuestion` 二选一确认,并简述两种形态的最终目录结构差异(多仓:`<name>-spec-center/` + 各 `<name>-<module>/`;单仓:当前目录原地、无 spec-center),让用户确认是其想要的效果后再执行。**不要从措辞擅自默认成某一种。**

`module` 语义独立(往已有工作区加模块),与上述初始化确认无关。三者都拿不准时,直接问:「是新建多仓工作区、往已有工作区加模块,还是原地初始化一个单仓库项目?」

## 2. Workspace 工作流

1. **收集输入**:
   - 项目名 `name`(kebab-case;可按需求替用户推荐一个)。
   - 工作区目录 `dir`(默认 `./<name>`;必须为空或不存在)。
   - 模块列表 `modules`:逗号分隔。`spec-center` 始终包含,无需用户指定。
2. **展示计划表并确认**:先按 §1 硬规则确认用户要的是多仓工作区;再列出将创建的目录(`<name>-spec-center` + 各模块)、是否建 git,等用户确认是其想要的效果。
3. **调脚本**(确认后):见 §6。脚本会自动生成 `spec-center/AGENTS.md` 的模块表与目录树,无需 Claude 介入。
4. **汇报**:转述脚本输出的 `created:` / `skipped:` 行;若出现 `partial:` 段(中途失败),按 §7 处理残留。完成后提示后续开发流程见 `<project>-spec-center/AGENTS.md`(含 spec-first 工作流)。

## 3. Module 工作流

1. **确认上下文**:工作区目录 `dir`。项目前缀 `name` **可省略**——脚本会从 `dir` 下唯一的 `<name>-spec-center/` 自动推断;Claude 可先 `ls` 工作区,把推断出的 `name` 报给用户确认。目录下有多个 `*-spec-center` 时脚本会报错,须显式传 `--name`。
2. **收集新模块** `modules`:已存在的模块、`spec-center` 会被脚本自动跳过并在汇总里标注 `skipped`。
3. **展示计划表并确认**。
4. **调脚本**(确认后):见 §6。脚本会按工作区实际模块自动把新模块并入 `spec-center/AGENTS.md` 的表与树。
5. **汇报**:转述 `added:` / `skipped:` 行;若出现 `partial:` 段,按 §7 处理残留。

## 4. Single 工作流(单仓库原地初始化)

1. **收集输入**:
   - 模板 `template`:单个 stack 模板(`server` / `web` / `client`),决定 Makefile、`.env.example`、Role 等 stack 特定脚手架。**必填**。
   - 工作区目录 `dir`(默认当前目录 `.`)。
   - 项目名 `name`:**可省略**——默认取 `dir` 的目录名;非 kebab-case 时脚本报错,提示显式传 `--name`。
2. **展示计划表并确认**:先按 §1 硬规则确认用户要的是单仓库;再列出目标目录、模板、项目名、是否复用/新建 git,等用户确认是其想要的效果。
3. **调脚本**(确认后):见 §6。脚本把模板铺进目录根(去掉 `-<template>` 后缀,命名统一为 `<name>`),用「综合 spec-center、去多仓库」的治理文档合并生成 `AGENTS.md`。契约/约定文档(API、错误码、约定)直接放 `docs/` 根,功能 specs / 计划复用 stack 模板自带的 `docs/specs`、`docs/plans`——**不建额外子目录**。
4. **汇报**:转述 `single:` / `created:` 行;若出现 `partial:` 段,按 §7 处理残留(单仓库只回收本次新建的条目,绝不动预存的 `.git`/用户文件)。完成后提示项目规则见生成的 `AGENTS.md`。

**防覆盖**:目标目录里若已存在模板要写的文件(`AGENTS.md`、`Makefile`、`docs/` 等),脚本报错中止(`.git` 不算冲突),绝不静默覆盖。

## 5. 模块模板对照

| 模板 | 用途 |
|---|---|
| `spec-center` | SSOT:跨模块契约 / 约定 / 错误码 / API。**workspace 始终包含,不可省略;module 不重复创建。** |
| `server` | 后端服务 |
| `web` | Web 应用 |
| `client` | 移动端 / 客户端应用 |

**模块语法**:`name`(内建模板,名即模板名)或 `name=template`(用 `template` 模板生成自定义名模块,如 `api-gateway=server`、`mobile=client`)。同一模板可多次生成不同名模块。

## 6. 脚本调用参考

脚本非交互,全部参数经 flag 传入:

```bash
# 初始化多仓工作区
node scripts/scaffold.mjs workspace \
  --name <project> \
  --dir <path> \           # 可选,默认 ./<project>;必须为空或不存在
  --modules <list> \       # 如 server,web 或 api-gateway=server,user-service=server
  [--no-git] [--dry-run]

# 向已有工作区添加
node scripts/scaffold.mjs module \
  [--name <project>] \     # 可选;省略时从 dir 下唯一的 <name>-spec-center 推断
  --dir <path> \           # 含 <project>-spec-center 的工作区目录
  --modules <list> \       # 已存在 / spec-center 会被自动跳过
  [--no-git] [--dry-run]

# 单仓库原地初始化
node scripts/scaffold.mjs single \
  --template <server|web|client> \  # 必填,单个 stack 模板
  --dir <path> \                    # 可选,默认当前目录 .
  [--name <project>] \              # 可选;省略时取 dir 目录名
  [--no-git] [--dry-run]
```

- `--dry-run`:只打印计划,不落盘。建议先 dry-run 给用户看,确认后再正式执行。
- `--no-git`:跳过 git 初始化。
- `node scripts/scaffold.mjs --help`:查看用法。

脚本路径相对本 skill 目录;调用时用脚本的绝对/正确相对路径。

## 7. `spec-center/AGENTS.md` 由脚本维护 + 失败残留处理

**结构生成全由脚本完成,Claude 不手工编辑。** 脚本在 workspace/module 末尾,按工作区实际存在的 `<project>-<module>/` 目录,重写 `spec-center/AGENTS.md` 里两处锚点区块(`<!-- MODULE_MAP_START/END -->`、`<!-- REPO_TREE_START/END -->`):Module Map 角色取自各模块自身 `AGENTS.md` 的 `## Role`,目录树连接线由结构计算。这是幂等操作——workspace/module/重跑结果一致,不依赖解析旧内容。**不要手动改这两个区块之间的内容**(锚点是 HTML 注释,不渲染)。

模块的语义留空块(各模块 `AGENTS.md` 的 Key Responsibilities / Tech Stack、spec-center 的 Core Domain Concepts 等)属于后续开发,不是 scaffold 职责,按需在开发中填。

**失败残留处理(脚本非原子)**:脚本中途失败时会在 stderr 打印:

```
partial: created before failure (not rolled back):
  <path1>
  <path2>
```

Claude 须读出这些路径,用 `AskUserQuestion` 问用户是否删除,确认后再删:

- **workspace 失败**:列出的第一个路径通常是整个工作区目录(workspace 前已校验为空/不存在),可整体删除后重来。
- **module 失败**:只列出本次新建的模块目录——**只删这些,绝不动既有模块**。
- **single 失败**:只列出本次新建的条目(若目标目录由本次创建,则含该目录;否则只列铺进去的文件/目录)——**绝不动预存的 `.git` 或用户文件**。

用户选择保留时,原样留下,提示其手工检查。

## 8. Git 行为

- **workspace / module**:每个新建模块只执行 `git init` + `git branch -M main`,**不** `git add`、**不** commit——交给用户自行首次提交。
- **single**:目标目录已有 `.git` 则**复用**(不重复 init、不改分支);否则 `git init` + `git branch -M main`。同样不 add、不 commit。
- `--no-git` 时整段跳过。

## 9. 后续与相关 skill

- **开发流程**:工作区建好后,spec-first 工作流(spec 划分/所有权、跨模块 plan 拆分、spec 索引维护)见生成的 `<project>-spec-center/AGENTS.md`——该模板内含 SDD 方法论,运行时直接承载,无需独立 skill。单仓库模式下,同等方法论(单仓库化)在生成的 `AGENTS.md` 里直接承载。
- `code-conventions`:横切规范文档体系。模板留空 `conventions/` 目录——通用规范运行时引用本 skill,不落地;`conventions/` 仅承载项目私有规范。
- `engineering-guidelines`:LLM/agent 编码行为准则。
