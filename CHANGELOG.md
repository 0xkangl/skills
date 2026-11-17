# Changelog

## [1.4.0](https://github.com/0xkangl/skills/compare/v1.3.0...v1.4.0) (2026-11-17)


### Features

* **docs-maintain:** 新增基于代码证据的文档维护 skill ([bccd829](https://github.com/0xkangl/skills/commit/bccd8290caf2be48ba629097d3ce17a56142be92))
* **engineering-guidelines:** add first-principles design constraints ([2fa4d86](https://github.com/0xkangl/skills/commit/2fa4d86ff5d7f22aaeeae6f744c8bd5bdbd9bb3f))
* **engineering-guidelines:** prefer worktrees and task delegation ([148afde](https://github.com/0xkangl/skills/commit/148afde96922273a48a4157b9f50b18ceb0c2241))
* **remediate-suggest:** 修复方案先评估删除与简化 ([951de64](https://github.com/0xkangl/skills/commit/951de6474239e84c8e272a8cf6f8c20a61019888))
* **remediate-suggest:** 要求多方案说明具体推荐理由 ([f9bb7a3](https://github.com/0xkangl/skills/commit/f9bb7a35bd608e1851b96209bd55645eea18cf1b))
* **remediation:** 支持审查补充要求并纳入修复验收 ([57003d6](https://github.com/0xkangl/skills/commit/57003d6c6f142066e80d0ed2ef8efa383d431392))
* **test-fix:** 增加修复提交与推送流程 ([8ad65aa](https://github.com/0xkangl/skills/commit/8ad65aad3d1d489d00082589180da6eea0b3e04a))
* **test-fix:** 添加手动测试运行与修复 skill ([8bc8675](https://github.com/0xkangl/skills/commit/8bc86752fa308bc0fdb214dc12bceb1b2dae852f))


### Bug Fixes

* **engineering-guidelines:** isolate worktree task branches ([2d351ad](https://github.com/0xkangl/skills/commit/2d351ad06002d06c42925a08707a88e6e6e69852))

## [1.3.0](https://github.com/0xkangl/skills/compare/v1.2.0...v1.3.0) (2026-11-11)


### Features

* **code-conventions:** 按业务模块组织 Go 服务代码 ([a625bee](https://github.com/0xkangl/skills/commit/a625beeb00397a47b6f15f57833c9a5e0ba85de2))
* **code-conventions:** 规范数据库分页、请求日志与缓存层级 ([63b1ddd](https://github.com/0xkangl/skills/commit/63b1ddd4a3cd51235c4bd6d3c5a018cd3ab1b5cf))


### Bug Fixes

* **code-conventions:** 对齐指令与示例并完善服务配置 ([de9367e](https://github.com/0xkangl/skills/commit/de9367e72b0cb08bc7597e95d828f2f7933164ce))
* **engineering-guidelines:** 对齐三方规范并恢复历史需求 ([6cd0487](https://github.com/0xkangl/skills/commit/6cd0487fe942e76de609c9ac5eb5fbdec7205afe))
* **skills:** 优化诊断修复编排与报告合并可靠性 ([dec6835](https://github.com/0xkangl/skills/commit/dec68358f2279d23bcd45ca0198115d8d019470a))

## [1.2.0](https://github.com/0xkangl/skills/compare/v1.1.0...v1.2.0) (2026-09-10)


### Features

* **agents-scaffold:** align generated agent workflows ([a73ce75](https://github.com/0xkangl/skills/commit/a73ce75fa4e52767e65349b2f795c09fa4fe9497))
* **agents-scaffold:** 模板主指令文档改为 AGENTS.md，CLAUDE.md 为一行指针 ([cb0f2b6](https://github.com/0xkangl/skills/commit/cb0f2b67ec87fb63b27feadcce629b2e246e5182))

## [1.1.0](https://github.com/0xkangl/skills/compare/v1.0.0...v1.1.0) (2026-09-10)


### Features

* **code-conventions:** 增加项目文档与仓库工作流规范及按需入口 ([1d07705](https://github.com/0xkangl/skills/commit/1d07705d567a4c576a8164722251a7d86dba8c4e))


### Bug Fixes

* **code-conventions:** 明确部署授权与失败恢复边界以避免无关阻塞 ([ff2da07](https://github.com/0xkangl/skills/commit/ff2da07f32e4eaab7f83a299c4644ac925cea509))
* **engineering-guidelines:** 校准执行边界与验证要求并补充中文对照 ([acbc0ba](https://github.com/0xkangl/skills/commit/acbc0bac9d94b28e28819130fcfbf80bfcd83f82))

## 1.0.0 (2026-08-21)

首个 plugin 化版本：新增 `.claude-plugin/` manifest 与自指 marketplace，支持在 Claude Code 里以 `/plugin` 两步装载全套 skills；后续版本由 release-please 依 Conventional Commits 自动生成。
