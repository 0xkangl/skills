# {{PROJECT}}-web

## Role
Web application

## Mandatory Specs
<!-- Link only to project-private conventions committed under ../{{PROJECT}}-spec-center/conventions/. Universal conventions come from the `code-conventions` skill at runtime (http-constitution, observability, testing, error-codes, deployment) — do not relink them here. -->

## Key Responsibilities
<!-- Define module-specific responsibilities here -->

## Tech Stack
<!-- Define technology choices here: language, framework, database, etc. -->

## Build & Test
<!-- Define build, test, lint commands here -->

## Deployment
<!-- 只记本模块的部署事实。发版前置资料、vars 与 secret 的归属判据、发版执行顺序、验证与回滚规则见 `code-conventions` skill 的部署规范 —— 不要在此重复。 -->

- **Platform / Project**: Cloudflare Workers <!-- 或 Pages;项目名 -->。部署只经 `wrangler` CLI + 最小权限 API token,**不接面板的 GitHub App / Git 集成**。
- **Config**: `wrangler.jsonc`(由 `wrangler.jsonc.example` 复制,入仓并 review)。非敏感且启动后通常不改的配置写 `vars`;敏感项走 `wrangler secret put`(本地用 `.dev.vars`),同一个 key 不得两处都写。
- **Release**: `make deploy`(顶层即 production;staging 用 `make deploy CF_ENV=staging`)
- **Verify**: <!-- 首屏/关键路径 smoke、`make deploy-status` 确认活跃版本、`make logs` 观察窗 -->
- **Rollback**: `make rollback VERSION_ID=<id>` <!-- 确认目标版本来源 -->
