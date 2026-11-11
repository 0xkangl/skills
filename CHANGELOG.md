# Changelog

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
