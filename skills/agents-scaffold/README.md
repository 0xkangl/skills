# agents-scaffold

用零依赖 Node 脚本在目标目录原地初始化单仓库项目。通过 `--template` 选择后端服务（`server`）、Web 应用（`web`）或移动、桌面客户端（`client`）。Agent 调用与冲突处理流程见 [SKILL.md](SKILL.md)。

## 快速上手

```bash
cd skills/agents-scaffold
node "scripts/scaffold.mjs" --template server --dir "./my service" --name my-service --dry-run
node "scripts/scaffold.mjs" --template server --dir "./my service" --name my-service
```

`--dir` 默认当前目录，`--name` 默认取目标目录名。预览会列出冲突文件，正式执行默认将它们备份为 `*.bak`（重名时追加序号）。需要直接覆盖时，两条命令都加 `--on-conflict overwrite`。已有 Git 仓库沿用原分支，新仓库初始化在 `main`；`--no-git` 可跳过初始化。

## 生成的文件

- `AGENTS.md` 汇集项目规则与所选技术栈的构建、测试、部署说明。`CLAUDE.md` 指向它。
- `CONTEXT.md` 维护项目词汇，`ROADMAP.md` 记录进度，`WORKFLOW.md` 说明何时更新规格、编写计划以及如何按变更风险选择 SDD/TDD。
- `docs/` 存放契约与私有约定，`docs/specs/` 和 `docs/plans/` 分别存放功能规格和实施计划。
- 各技术栈带有对应的 Makefile；后端附 Fly.io 配置示例，Web 附 Cloudflare Workers 配置示例。

## 测试

在本 skill 目录运行：

```bash
node --test scripts/scaffold.test.mjs
```
