# agents-scaffold

零依赖 Node 脚本搭建多仓工作区（`spec-center` SSOT + 各模块仓），或在目标目录原地初始化单个独立仓库；并产出跨 agent 的 `AGENTS.md` 指令入口（`CLAUDE.md` 为一行 `@AGENTS.md` 指针）。

skill 的完整意图判定与工作流见 [SKILL.md](SKILL.md)；下面是直接调脚本的快速上手。

## 快速上手

```bash
cd skills/agents-scaffold

# 预览计划（不落盘）
node scripts/scaffold.mjs workspace --name myapp --dir ./myapp --modules server,web --dry-run

# 正式初始化：在 --dir 原地生成 myapp-spec-center + myapp-server + myapp-web
# （--dir 默认当前目录 .；目录已含 *-spec-center 才报错；目录自动合并，文件冲突默认备份为
#   *.bak，仅需覆盖时加 --on-conflict overwrite）
node scripts/scaffold.mjs workspace --name myapp --dir ./myapp --modules server,web

# 向已有工作区新增模块（支持 name=template 自定义命名；dir 没有 *-spec-center 时自动转 workspace）
node scripts/scaffold.mjs module --name myapp --dir ./myapp --modules api-gateway=server

# 单仓库：在目标目录原地初始化一个独立项目（非子模块、无 spec-center）
node scripts/scaffold.mjs single --template server --dir ./my-service --dry-run
node scripts/scaffold.mjs single --template server --dir ./my-service
```

## 生成的治理文档

- `AGENTS.md` 只保留项目架构、契约归属、指令层级与高频工作默认。多仓模式的各模块入口会明确加载兄弟 `spec-center/AGENTS.md`，避免从独立模块仓启动 agent 时遗漏全局规则。
- `WORKFLOW.md` 按需承载 spec-first、契约修订、计划拆分与测试细则，不占用每次会话的常驻上下文。
- 按变更风险选择 SDD/TDD：契约、跨模块、架构、数据与迁移类改动先更新 spec；范围清晰、可逆的小改可直接实施，并按风险选择有信号的验证。
- `ROADMAP.md` 只在规划或继续已跟踪工作、以及项目状态变化时读写；普通未跟踪小改不制造进度记录。

skill 会先运行 `--dry-run`。输入和授权已明确且无冲突时可直接继续；只在结果仍有关键歧义或存在未授权文件冲突时追问。

## 开发与测试

脚本是零依赖 Node（仅 `node:` 内置模块），用内置 test runner 跑：

```bash
cd skills/agents-scaffold
node --test scripts/scaffold.test.mjs
```
