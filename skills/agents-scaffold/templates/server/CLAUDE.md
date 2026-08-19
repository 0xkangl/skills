# {{PROJECT}}-server

## Role
Server application

## Mandatory Specs
<!-- Link only to project-private conventions committed under ../{{PROJECT}}-spec-center/conventions/. Universal conventions come from the `code-conventions` skill at runtime (http-constitution, observability, testing, error-codes, deployment, golang/go-project, golang/go-style, golang/go-testing, golang/go-validation) — do not relink them here. -->

## Key Responsibilities
<!-- Define module-specific responsibilities here -->

## Tech Stack
<!-- Define technology choices here: language, framework, database, etc. -->

## Build & Test
<!-- Define build, test, lint commands here -->

## Deployment
<!-- 只记本模块的部署事实。发版前置资料、[env] 与 secret 的归属判据、发版执行顺序、验证与回滚规则见 `code-conventions` skill 的部署规范 —— 不要在此重复。 -->

- **Platform / App**: Fly.io <!-- app 名;staging 与 production 各一个 app -->
- **Config**: `fly.toml`(由 `fly.toml.example` 复制,入仓并 review)。非敏感且启动后通常不改的配置写 `[env]`;敏感项走 `flyctl secrets set`,同一个 key 不得两处都写。
- **Release**: `make deploy`(含 release-check) <!-- 例行发版命令与触发条件 -->
- **Verify**: <!-- 健康端点、版本回显、关键路径 smoke、观察窗 -->
- **Rollback**: <!-- 回滚到哪个版本、用哪条命令 -->
