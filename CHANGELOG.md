# Changelog

## [1.1.0](https://github.com/0xkangl/skills/compare/v1.0.0...v1.1.0) (2026-09-10)


### Features

* **code-conventions:** 增加项目文档与仓库工作流规范及按需入口 ([1d07705](https://github.com/0xkangl/skills/commit/1d07705d567a4c576a8164722251a7d86dba8c4e))


### Bug Fixes

* **code-conventions:** 明确部署授权与失败恢复边界以避免无关阻塞 ([ff2da07](https://github.com/0xkangl/skills/commit/ff2da07f32e4eaab7f83a299c4644ac925cea509))
* **engineering-guidelines:** 校准执行边界与验证要求并补充中文对照 ([acbc0ba](https://github.com/0xkangl/skills/commit/acbc0bac9d94b28e28819130fcfbf80bfcd83f82))

## 1.0.0 (2026-08-21)

首个 plugin 化版本：新增 `.claude-plugin/` manifest 与自指 marketplace，支持在 Claude Code 里以 `/plugin` 两步装载全套 skills；后续版本由 release-please 依 Conventional Commits 自动生成。
