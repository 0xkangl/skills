---
name: agents-scaffold
disable-model-invocation: true
description: 使用零依赖 Node 脚本在目标目录初始化单仓库项目，生成所选技术栈的脚手架和治理文档，预览文件冲突并按授权备份或覆盖。
allowed-tools: Bash, Read, AskUserQuestion
---

# Agents Scaffold

在目标目录原地初始化一个独立仓库。仅在用户明确调用本 skill 时执行，接受宿主支持的调用语法。工具权限以宿主为准。

## 输入与预览

1. 确定技术栈 `--template`（后端 `server`、Web 应用 `web`、移动或桌面客户端 `client`）和目标目录 `--dir`（默认当前目录）。`--name` 默认取目标目录名。项目名须为 2–50 个字符，以小写字母开头，由小写字母、数字和分隔用的连字符组成。目录名不符合要求时显式提供项目名。
2. 运行 `--dry-run` 核对目标、项目名、模板和冲突路径。输入已明确且无冲突，或冲突策略已有授权时，直接执行。只在缺少影响结果的输入、存在未授权冲突或用户要求先看计划时询问。
3. 目录逐层合并。有文件冲突时，列出具体路径供用户选择备份、覆盖或取消。默认备份将原文件改名为 `*.bak`，重名时依次使用 `*.bak.1`、`*.bak.2`。仅在明确授权覆盖时，在预览和正式命令中都加 `--on-conflict overwrite`。

## 执行

以下示例从本 skill 目录运行。从其它位置调用时使用脚本的实际路径，`--dir` 相对命令执行目录解析。正式执行沿用预览参数，只移除 `--dry-run`。

```bash
node "scripts/scaffold.mjs" --template server --dir "./my service" --name my-service --dry-run
node "scripts/scaffold.mjs" --template server --dir "./my service" --name my-service
```

脚本复用目标目录已有的 `.git` 和分支。新建仓库时初始化空的 `main` 分支，首次提交留给用户。需要跳过 Git 初始化时，两条命令都加 `--no-git`。

## 产物与结果

脚本将技术栈文件和共用治理文档写到仓库根目录。项目规则与技术栈说明见 `AGENTS.md`，`CLAUDE.md` 指向该文件。术语、进度与详细开发流程分别见 `CONTEXT.md`、`ROADMAP.md`、`WORKFLOW.md`。契约与项目私有约定放在 `docs/`，功能规格和实施计划分别放在 `docs/specs/`、`docs/plans/`。

完成后转述 `created:` 和全部 `backed up:` 路径。若中途失败，报告 stderr 中 `partial:` 列出的已写入路径，以及另列的原文件备份。清理前核对具体路径和授权，保留备份、已有的 `.git` 和用户文件。
