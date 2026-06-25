---
name: agents-scaffold
disable-model-invocation: true
description: Scaffolds a multi-repo (polyrepo) workspace, adds web / server / client / custom modules to an existing one, or initializes a standalone single-repo project in place from one template. Sets up the spec-center SSOT plus per-module repos (or a single repo's in-repo specs/contracts) with shared AGENTS.md conventions via a zero-dependency Node script.
allowed-tools: Bash, Read, AskUserQuestion
---

# Agents Scaffold

> 偶发的结构性操作:搭建多仓工作区、向其中新增模块,或原地初始化单个独立仓库。所有确定性产物——拷模板、`{{PROJECT}}` 替换、`git init`,以及 `spec-center/AGENTS.md` 的 Module Map 表与 Repository Structure 树——全部由零依赖脚本 `scripts/scaffold.mjs` 完成,以工作区实际存在的模块目录为单一真相,幂等。Claude 只负责:意图判定、收集输入、确认计划、调脚本、(失败时)处理残留、转述输出——不手工编辑生成产物。

## 1. 模式选择(两步推导)

三种模式:**workspace**(从零建多仓工作区:root + `spec-center` + 所选模块,每个模块落 `<project>-<module>/`)、**module**(往已有工作区加模块)、**single**(单仓库:目标目录**原地**用单个 stack 模板初始化,无 spec-center)。

判断顺序:**先看文件系统状态,再判用户意图**。先 `ls` 目标目录看有没有 `*-spec-center/`:

1. **有 `*-spec-center/`** → **module**(目录已是工作区,这次必是加模块,无需再判单/多仓)。
2. **没有 `*-spec-center/`** → 再从用户需求判**单仓还是多仓**:
   - 多仓信号:「多仓工作区 / 微服务 / 拆成多个仓 / 要 spec-center」→ **workspace**。
   - 单仓信号:「单仓库 / 单个仓库 / monorepo / 不要 spec-center / 就地建一个项目」→ **single**。
   - **推导不出来再问**:`AskUserQuestion` 二选一,并简述两种最终目录结构差异(多仓:`<name>-spec-center/` + 各 `<name>-<module>/`;单仓:当前目录原地、无 spec-center)。「初始化 server 项目」里 `server` 只表明所选模板,不表明仓库形态——这类纯模板措辞**不要擅自默认**成某一种。

> 脚本侧有兜底,模式判断只需大方向对、边界由脚本纠正:`module` 子命令若发现目录里没有任何 `*-spec-center/`,会自动按 `workspace` 处理;`workspace` 子命令若发现已存在 `*-spec-center/` 则报错(已是工作区)。

## 2. Workspace 工作流

1. **收集输入**:
   - 项目名 `name`(kebab-case;可按需求替用户推荐一个)。
   - 工作区目录 `dir`(**默认当前目录 `.`,原地初始化,不再套一层 `<name>` 子目录**)。判据不是"目录是否为空",而是"是否已有 `<name>-spec-center/`":只要目录里没有任何 `*-spec-center/`,即使已装 skills(`.agents`、`skills-lock.json` 等隐藏/无关文件)也可原地初始化;已含 `*-spec-center` 则脚本报错(已是工作区)。
   - 模块列表 `modules`:逗号分隔。`spec-center` 始终包含,无需用户指定。
2. **展示计划表并确认**:列出将创建的目录(`<name>-spec-center` + 各模块)、目标目录(默认 `.`)、是否建 git,等用户确认是其想要的效果。
   - **冲突处理(默认备份,见 §10)**:目录自动合并;root 模板文件撞既有同名文件**默认备份**,无需另问。dry-run 的 `conflicts (will back up): ...` 行可提前告诉用户哪些文件会被备份。
3. **调脚本**(确认后):见 §6。脚本会自动生成 `spec-center/AGENTS.md` 的模块表与目录树,无需 Claude 介入。
4. **汇报**:转述脚本输出的 `created:` / `skipped:` 行,以及 `backed up:` 列出的备份文件(见 §10);若出现 `partial:` 段(中途失败),按 §7 处理残留。完成后提示后续开发流程见 `<project>-spec-center/AGENTS.md`(含 spec-first 工作流)。

## 3. Module 工作流

1. **确认上下文**:工作区目录 `dir`。项目前缀 `name` **可省略**——脚本会从 `dir` 下唯一的 `<name>-spec-center/` 自动推断;Claude 可先 `ls` 工作区,把推断出的 `name` 报给用户确认。目录下有多个 `*-spec-center` 时脚本会报错,须显式传 `--name`。**若 `dir` 下根本没有 `*-spec-center/`**,脚本自动按 workspace 初始化(此时 `name` 取传入值或目录名),汇总会显示 `workspace:`——这正是 §1 的兜底,按 workspace 汇报即可。
2. **收集新模块** `modules`:已存在的模块、`spec-center` 会被脚本自动跳过并在汇总里标注 `skipped`。
3. **展示计划表并确认**。
4. **调脚本**(确认后):见 §6。脚本会按工作区实际模块自动把新模块并入 `spec-center/AGENTS.md` 的表与树。
5. **汇报**:转述 `added:` / `skipped:` 行,以及 `backed up:` 备份文件(见 §10);若出现 `partial:` 段,按 §7 处理残留。

## 4. Single 工作流(单仓库原地初始化)

1. **收集输入**:
   - 模板 `template`:单个 stack 模板(`server` / `web` / `client`),决定 Makefile、`.env.example`、Role 等 stack 特定脚手架。**必填**。
   - 工作区目录 `dir`(默认当前目录 `.`)。
   - 项目名 `name`:**可省略**——默认取 `dir` 的目录名;非 kebab-case 时脚本报错,提示显式传 `--name`。
2. **展示计划表并确认**:列出目标目录、模板、项目名、是否复用/新建 git,等用户确认是其想要的效果。
3. **调脚本**(确认后):见 §6。脚本把模板铺进目录根(去掉 `-<template>` 后缀,命名统一为 `<name>`),用「综合 spec-center、去多仓库」的治理文档合并生成 `AGENTS.md`。契约/约定文档(API、错误码、约定)直接放 `docs/` 根,功能 specs / 计划复用 stack 模板自带的 `docs/specs`、`docs/plans`——**不建额外子目录**。
4. **汇报**:转述 `single:` / `created:` 行,以及 `backed up:` 备份文件(见 §10);若出现 `partial:` 段,按 §7 处理残留(单仓库只回收本次新建的条目,绝不动预存的 `.git`/用户文件)。完成后提示项目规则见生成的 `AGENTS.md`。

**冲突处理(默认备份,见 §10)**:目录自动合并;目标目录里若已存在模板要写的文件(`AGENTS.md`、`Makefile` 等),**默认备份**为 `*.bak` 再写(`.git` 不在模板内,永不冲突)。

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
  --dir <path> \           # 可选,默认当前目录 .;原地初始化,仅当已含 *-spec-center 时报错
  --modules <list> \       # 如 server,web 或 api-gateway=server,user-service=server
  [--on-conflict overwrite] \  # 可选;默认备份(*.bak),仅用户明确要覆盖时传 overwrite
  [--no-git] [--dry-run]

# 向已有工作区添加
node scripts/scaffold.mjs module \
  [--name <project>] \     # 可选;省略时从 dir 下唯一的 <name>-spec-center 推断
  --dir <path> \           # 含 <project>-spec-center 的工作区目录;没有则自动转 workspace
  --modules <list> \       # 已存在 / spec-center 会被自动跳过
  [--on-conflict overwrite] \  # 同上;默认备份
  [--no-git] [--dry-run]

# 单仓库原地初始化
node scripts/scaffold.mjs single \
  --template <server|web|client> \  # 必填,单个 stack 模板
  --dir <path> \                    # 可选,默认当前目录 .
  [--name <project>] \              # 可选;省略时取 dir 目录名
  [--on-conflict overwrite] \       # 同上;默认备份
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

- **workspace 失败**:原地初始化,只列出**本次新建**的条目(目录由本次创建则含该目录;否则仅列铺进去的 root 顶层文件 + 各模块目录)——**只删这些,绝不动用户既有文件/目录**。若同时打印了 `backed up (originals preserved)`,那是被备份的用户原文件(`*.bak`),**绝不删除**,提示用户自行核对/恢复。
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

## 10. 冲突与备份(三种模式统一)

脚本对所有模式用同一套策略,Claude **不必为冲突单独发问**:

- **目录自动合并**:模板里的目录撞上目标目录既有同名目录,逐层合并,既有内容保留。
- **文件冲突默认备份**:模板文件落点已存在同名文件时,**默认**把原文件改名为 `*.bak`(已占用则 `*.bak.1`、`*.bak.2`…)再写模板。原文件全部留档,不丢。
- **仅用户明确说「覆盖」时**才传 `--on-conflict overwrite`:直接覆盖、不留 `*.bak`。
- **`.git` 与无关文件永不触碰**:它们不在模板树内,既不合并也不备份。

汇报时:dry-run 阶段转述 `conflicts (will back up): ...` 让用户预览将被备份的文件;正式执行后,把脚本输出的所有 `backed up: <path>.bak` 行**完整列给用户**,提示其自行核对/恢复。
