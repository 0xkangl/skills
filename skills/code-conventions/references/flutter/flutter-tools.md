# Flutter / Dart Tooling Convention v1.0

> Applies to: 所有 Flutter / Dart 模块 | Goal: 统一格式化、静态分析、代码生成与依赖工具，让本地与 CI 一致

For the full convention index, see [../../SKILL.md](../../SKILL.md).

风格见 [flutter-style.md](flutter-style.md)。本篇定工具链。

## 1. Toolchain

| 关注点 | 工具 | 命令 |
|---|---|---|
| 格式化 | **dart format** | `dart format --set-exit-if-changed .` |
| 静态分析 | **dart analyze** / **flutter analyze** | `flutter analyze` |
| 自动修复 | **dart fix** | `dart fix --apply` |
| 代码生成 | **build_runner** | `dart run build_runner build --delete-conflicting-outputs` |
| 测试 | **flutter test** | 见 [flutter-testing.md](flutter-testing.md) |
| 依赖 | **pub** | `flutter pub get`，`pubspec.lock` 入库 |

## 2. analysis_options.yaml

启用严格 lint 规则集，CI 中零告警通过：

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
- `flutter analyze` 在 CI 阻断；告警视为错误。

## 3. Code Generation

- freezed / json_serializable / riverpod / go_router_builder 用 `build_runner` 生成。
- 生成文件按项目统一策略提交或 gitignore，二选一保持一致。
- 改注解后重跑 `build_runner build --delete-conflicting-outputs`。

## 4. Dependencies

- `pubspec.yaml` 固定关键依赖版本范围；`pubspec.lock` 入库保证可复现。
- 区分 `dependencies` 与 `dev_dependencies`。
- 定期 `flutter pub outdated` 审查升级。

## 5. Unified Commands

```makefile
fmt:    ; dart format .
lint:   ; flutter analyze
gen:    ; dart run build_runner build --delete-conflicting-outputs
test:   ; flutter test --coverage
check:  fmt lint test
```

## 6. Checklist

- [ ] `dart format --set-exit-if-changed` + `flutter analyze` 零告警。
- [ ] `analysis_options.yaml` 启用严格 lint（very_good_analysis / flutter_lints）。
- [ ] 生成文件策略统一，改注解后重跑 build_runner。
- [ ] `pubspec.lock` 入库。
- [ ] 提供统一命令入口。
