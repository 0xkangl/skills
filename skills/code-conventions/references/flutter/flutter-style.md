# Flutter / Dart Style Convention v1.0

> Applies to: 所有 Flutter / Dart 模块 | Goal: 写出不可变、null 安全、分层清晰的 Dart 代码——sealed 类型穷尽匹配，widget 组合而非继承

For the full convention index, see [../../SKILL.md](../../SKILL.md).

在通用 [coding-style.md](../coding-style.md) 与 [patterns.md](../patterns.md) 之上扩展 Dart/Flutter 专项。工具见 [flutter-tools.md](flutter-tools.md)，测试见 [flutter-testing.md](flutter-testing.md)，安全见 [flutter-security.md](flutter-security.md)。

## 1. Formatting

- `dart format` 格式化所有 `.dart`，CI 中 `dart format --set-exit-if-changed .`。
- 行宽 80（默认）；多行参数列表带尾逗号，改善 diff 与格式化。

## 2. Naming

- `camelCase`：变量、参数、具名构造函数。
- `PascalCase`：类、枚举、typedef、extension。
- `snake_case`：文件名、库名。
- 私有成员前缀 `_`；extension 名描述所扩展类型（`StringExtensions`）。

## 3. Immutability

- 局部用 `final`，编译期常量用 `const`；字段全 `final` 时用 `const` 构造函数。
- 公共 API 返回不可修改集合（`List.unmodifiable`）。
- 不可变状态类用 `copyWith()` 做变更；复杂状态用 `freezed` 生成。

```dart
// Bad
var count = 0;
// Good
final count = 0;
const items = ['a', 'b'];
```

## 4. Null Safety

- **避免 `!`**（bang）——优先 `?.` / `??` / `if (x != null)` 卫语句 / 模式匹配；仅当 null 属编程错误、崩溃才正确时用 `!`。
- 避免 `late`，除非首次使用前保证初始化；优先可空或构造注入。
- 必传构造参数用 `required`。

```dart
final name = user?.name ?? 'Unknown';

String getUserName(User? user) {
  if (user == null) return 'Unknown';
  return user.name;   // 卫语句后提升为非空
}
```

## 5. Sealed Types & Pattern Matching (Dart 3+)

用 sealed 类建模封闭状态层级，`switch` 穷尽匹配、不用 default/通配：

```dart
sealed class AsyncState<T> { const AsyncState(); }
final class Loading<T> extends AsyncState<T> { const Loading(); }
final class Success<T> extends AsyncState<T> { const Success(this.data); final T data; }
final class Failure<T> extends AsyncState<T> { const Failure(this.error); final Object error; }

return switch (state) {
  Loading() => const CircularProgressIndicator(),
  Success(:final data) => DataWidget(data),
  Failure(:final error) => ErrorWidget(error.toString()),
};
```

## 6. Error Handling

- `on` 子句指定异常类型，**绝不**裸 `catch (e)`；绝不 catch `Error` 子类（属程序 bug）。
- 可恢复错误用 `Result` 风格 / sealed 类，不用异常做控制流。

```dart
try {
  await fetchUser();
} on NetworkException catch (e) {
  log('Network error: ${e.message}');
} on NotFoundException {
  handleNotFound();
}
```

## 7. Async / Futures

- 总是 `await` Future，或显式 `unawaited()` 标记有意 fire-and-forget。
- 从不 `await` 任何东西的函数不要标 `async`。
- 并发用 `Future.wait` / `Future.any`。
- `await` 之后用 `BuildContext` 前检查 `context.mounted`（Flutter 3.7+）。

## 8. Imports & Codegen

- 跨特性 / 跨层用 `package:` 导入，**不用**相对 `../`；顺序 `dart:` → 外部 `package:` → 内部 `package:`，无未用导入。
- 生成文件（`.g.dart` / `.freezed.dart`）按项目统一策略提交或 gitignore；**绝不**手改生成文件，注解只留在源文件。

## 9. Architecture & Widgets

清晰分层（见 [patterns.md](../patterns.md)），依赖单向：

```
lib/
├── domain/        # 纯 Dart，不 import flutter / 数据层
├── data/          # 实现 domain 接口，DTO 在边界映射为实体
└── presentation/  # widget + 状态管理（BLoC / Riverpod / ViewModel）
```

- domain 层不依赖 `package:flutter` 或数据层；presentation 调 use case，不直接调 repository。
- widget **组合优于继承**：抽小 widget、传 `child`，不深继承。
- 状态管理选一套（BLoC/Cubit、Riverpod、或 ChangeNotifier ViewModel），依赖经构造注入（`get_it` / Riverpod provider）。

## 10. Checklist

- [ ] `dart format` + `dart analyze` 全绿（见 flutter-tools.md）。
- [ ] 命名遵循 Dart 约定，私有成员 `_` 前缀。
- [ ] 默认 `final` / `const`，状态类用 `copyWith` / freezed。
- [ ] null 安全：避免 `!` / `late`，必传用 `required`。
- [ ] sealed 类 + 穷尽 `switch`，无裸 `catch`。
- [ ] Future 都 await 或 `unawaited`；`await` 后查 `context.mounted`。
- [ ] `package:` 导入，分层依赖单向，domain 不依赖 flutter。
