# {{PROJECT}}-client

## Role
Client application (Android, iOS, desktop)

## Project Rules

Before project work, read [../{{PROJECT}}-spec-center/AGENTS.md](../{{PROJECT}}-spec-center/AGENTS.md). When planning or continuing tracked work, also read [../{{PROJECT}}-spec-center/ROADMAP.md](../{{PROJECT}}-spec-center/ROADMAP.md). If the sibling spec-center is unavailable, report the missing shared context instead of guessing contracts.

## Mandatory Specs
<!-- Link only to project-private conventions committed under ../{{PROJECT}}-spec-center/conventions/. Universal conventions come from the `code-conventions` skill at runtime — do not relink them here. -->

## Key Responsibilities
<!-- Define module-specific responsibilities here -->

## Tech Stack
<!-- Define technology choices here: language, framework, database, etc. -->

## Build & Test
<!-- Define build, test, lint commands here -->

- **CI / Workflows**: 使用 GitHub 托管时，按 `code-conventions` skill 在 `.github/workflows/` 配置适用的持续集成检查；需要自动部署或发布时配置对应 workflow。已有 workflow 优先维护；技术栈与检查命令确定后生成 CI workflow，发布方式确定后再生成部署／发布 workflow，相关变更时同步维护。

## Deployment

- **Documentation**: 首次发布前，按 `code-conventions` skill 维护发布文档（沿用已有位置，否则使用 `docs/release.md`），在本节添加实际文档链接；README 如存在则同步入口。流程或配置变更时同步更新。初始化时方案尚未确定，待确定后再创建文档。

<!-- 只记本模块的发布事实。发版前置资料、执行顺序、验证与回滚规则见 `code-conventions` skill 的部署规范 —— 不要在此重复。 -->

- **Channels**: <!-- App Store / Google Play / 企业分发 / 桌面安装包 -->
- **Signing assets**: <!-- 证书、keystore、provisioning profile 的存放位置;绝不入仓 -->
- **Release**: <!-- 构建与上传/提审命令,版本号与 build number 规则 -->
- **Verify**: <!-- 内测/灰度渠道的验证方式 -->
- **Rollback**: <!-- 下架、回滚或强制更新通道 -->
