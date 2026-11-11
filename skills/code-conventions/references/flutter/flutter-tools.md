# Flutter / Dart Tooling Convention v1.0

> Applies to: 所有 Flutter / Dart 模块 | Goal: 统一格式化、静态分析、代码生成与依赖工具，让本地与 CI 一致

For the full convention index, see [../../SKILL.md](../../SKILL.md).

风格见 [flutter-style.md](flutter-style.md)。本篇定工具链。

先识别模块类型：纯 Dart 包使用 Dart 命令和已采用的 lint/test 配置；Flutter 应用或插件使用 Flutter 命令。代码生成仅适用于实际采用生成器的模块，平台发布要求仅作用于对应目标平台。

## 1. Toolchain

| 关注点 | 工具 | 命令 |
|---|---|---|
| 格式化 | **dart format** | `dart format --set-exit-if-changed .` |
| 静态分析 | **dart analyze** / **flutter analyze** | 纯 Dart：`dart analyze`；Flutter：`flutter analyze` |
| 自动修复 | **dart fix** | `dart fix --apply` |
| 代码生成 | **build_runner** | `dart run build_runner build --delete-conflicting-outputs` |
| 测试 | **dart test** / **flutter test** | 纯 Dart：`dart test`；Flutter：`flutter test`；见 [flutter-testing.md](flutter-testing.md) |
| 依赖 | **pub** | 纯 Dart：`dart pub get`；Flutter：`flutter pub get`；`pubspec.lock` 入库 |

## 2. analysis_options.yaml

启用严格 lint 规则集，CI 中零告警通过。以下为 Flutter 配置；纯 Dart 使用项目采用的 Dart 规则集，不引入 Flutter 专属依赖或规则：

```yaml
include: package:very_good_analysis/analysis_options.yaml
# 或官方 package:flutter_lints/flutter.yaml

analyzer:
  language:
    strict-casts: true
    strict-raw-types: true
  errors:
    invalid_annotation_target: ignore   # freezed 常见

linter:
  rules:
    prefer_const_constructors: true
    require_trailing_commas: true
    avoid_print: true
```

- 推荐 **very_good_analysis**（更严格）或官方 **flutter_lints**。
- 对应模块的 `dart analyze` / `flutter analyze` 在 CI 阻断；告警视为错误。

## 3. Code Generation

- freezed / json_serializable / riverpod / go_router_builder 用 `build_runner` 生成。
- 生成文件按项目统一策略提交或 gitignore，二选一保持一致。
- 改注解后重跑 `build_runner build --delete-conflicting-outputs`。

## 4. Dependencies

- `pubspec.yaml` 固定关键依赖版本范围；`pubspec.lock` 入库保证可复现。
- 区分 `dependencies` 与 `dev_dependencies`。
- 定期用 `dart pub outdated`（纯 Dart）或 `flutter pub outdated`（Flutter）审查升级。

## 5. Unified Commands

以下为采用代码生成的 Flutter 模块示例。纯 Dart 模块将 `lint` / `test` 分别替换为 `dart analyze` / `dart test`，覆盖率使用项目已采用的 Dart 收集方式；未采用生成器时省去 `gen`，已有任务运行器保留等价入口。

```makefile
fmt:    ; dart format .
lint:   ; flutter analyze
gen:    ; dart run build_runner build --delete-conflicting-outputs
test:   ; flutter test --coverage
check:  fmt lint test
```

## 6. Checklist

- [ ] `dart format --set-exit-if-changed` + 模块对应的 `dart analyze` / `flutter analyze` 零告警。
- [ ] `analysis_options.yaml` 启用适用的严格 lint；Flutter 可选 very_good_analysis / flutter_lints，纯 Dart 不引入 Flutter 规则。
- [ ] 使用生成器时，生成文件策略统一，改注解后重跑 build_runner。
- [ ] `pubspec.lock` 入库。
- [ ] 提供统一命令入口。
