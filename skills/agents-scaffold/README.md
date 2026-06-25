# agents-scaffold

零依赖 Node 脚本搭建多仓工作区（`spec-center` SSOT + 各模块仓），或在目标目录原地初始化单个独立仓库；并产出含 spec-first/SDD 工作流的 `AGENTS.md`。

skill 的完整意图判定与工作流见 [SKILL.md](SKILL.md)；下面是直接调脚本的快速上手。

## 快速上手

```bash
cd skills/agents-scaffold

# 预览计划（不落盘）
node scripts/scaffold.mjs workspace --name myapp --modules server,web --dry-run

# 正式初始化：生成 myapp-spec-center + myapp-server + myapp-web
node scripts/scaffold.mjs workspace --name myapp --modules server,web

# 向已有工作区新增模块（支持 name=template 自定义命名）
node scripts/scaffold.mjs module --name myapp --dir ./myapp --modules api-gateway=server

# 单仓库：在目标目录原地初始化一个独立项目（非子模块、无 spec-center）
node scripts/scaffold.mjs single --template server --dir ./my-service --dry-run
node scripts/scaffold.mjs single --template server --dir ./my-service
```

## 开发与测试

脚本是零依赖 Node（仅 `node:` 内置模块），用内置 test runner 跑：

```bash
cd skills/agents-scaffold
node --test scripts/scaffold.test.mjs
```
