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

- **CI / Workflows**: 使用 GitHub 托管时，按 `code-conventions` skill 在 `.github/workflows/` 配置适用的持续集成检查；需要自动部署或发布时配置对应 workflow。已有 workflow 优先维护；技术栈与检查命令确定后生成 CI workflow，发布方式确定后再生成部署／发布 workflow，相关变更时同步维护。

## Deployment

- **Documentation**: 首次部署前，按 `code-conventions` skill 维护部署文档（沿用已有位置，否则使用 `docs/deployment.md`），在本节与 README 中添加实际文档链接；流程或配置变更时同步更新。初始化时方案尚未确定，待确定后再创建文档。

<!-- 只记本模块的部署事实。发版前置资料、[env] 与 secret 的归属判据、发版执行顺序、验证与回滚规则见 `code-conventions` skill 的部署规范 —— 不要在此重复。 -->

- **Platform / App**: Fly.io <!-- app 名;staging 与 production 各一个 app -->
- **Config**: `fly.toml`(由 `fly.toml.example` 复制,入仓并 review)。非敏感且启动后通常不改的配置写 `[env]`;敏感项走 `flyctl secrets set`,同一个 key 不得两处都写。
- **Release**: `make deploy`(含 release-check) <!-- 例行发版命令与触发条件 -->
- **Verify**: <!-- 健康端点、版本回显、关键路径 smoke、观察窗 -->
- **Rollback**: <!-- 回滚到哪个版本、用哪条命令 -->
