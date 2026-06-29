# Flutter / Dart Testing Convention v1.0

> Applies to: 所有 Flutter / Dart 模块 | Goal: 用 flutter_test 覆盖业务逻辑、widget 行为与关键流程，优先手写 fake，控制时间与异步

For the full convention index, see [../../SKILL.md](../../SKILL.md).

在通用 [testing.md](../testing.md) 之上扩展 Dart/Flutter 专项。

## 1. Framework

| 工具 | 用途 |
|---|---|
| `flutter_test` / `dart:test` | 内建测试运行器 |
| `bloc_test` | BLoC / Cubit 单测 |
| `mocktail`（无代码生成）/ `mockito` | mock |
| `fake_async` | 单测中控制时间 |
| `integration_test` | 真机 / 模拟器端到端 |

## 2. Test Types

| 类型 | 工具 | 位置 | 何时写 |
|---|---|---|---|
| Unit | `dart:test` | `test/unit/` | 领域逻辑、状态管理、repository |
| Widget | `flutter_test` | `test/widget/` | 有实质行为的 widget |
| Golden | `flutter_test` | `test/golden/` | 设计关键 UI 组件 |
| Integration | `integration_test` | `integration_test/` | 关键用户流程 |

## 3. State Manager Tests

BLoC 用 `bloc_test`：

```dart
blocTest<CartBloc, CartState>(
  'emits updated items when CartItemAdded',
  build: () => CartBloc(repository),
  act: (b) => b.add(CartItemAdded(testItem)),
  expect: () => [CartState(items: [testItem])],
);
```

Riverpod 用 `ProviderContainer` + override：

```dart
test('usersProvider loads users from repository', () async {
  final container = ProviderContainer(
    overrides: [userRepositoryProvider.overrideWithValue(FakeUserRepository())],
  );
  addTearDown(container.dispose);
  expect(await container.read(usersProvider.future), isNotEmpty);
});
```

测全部状态迁移：loading → success、loading → error、retry。

## 4. Widget Tests

```dart
testWidgets('CartPage shows item count badge', (tester) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [cartNotifierProvider.overrideWith(() => FakeCartNotifier([testItem]))],
      child: const MaterialApp(home: CartPage()),
    ),
  );
  await tester.pump();
  expect(find.text('1'), findsOneWidget);
});
```

## 5. Fakes Over Mocks

复杂依赖优先**手写 fake**（实现接口、内存存储），mock 只用于简单边界：

```dart
class FakeUserRepository implements UserRepository {
  final _users = <String, User>{};
  @override
  Future<User?> getById(String id) async => _users[id];
  // …其余实现
}
```

## 6. Async & Golden

- 时间 / 定时器用 `fake_async` 控制（`async.elapse(...)`），不真等。
- Golden 测试做视觉回归，有意改动时 `flutter test --update-goldens`。

## 7. Naming & Organization

测试名描述行为：`returns null when user does not exist`、`disables submit button while form is invalid`。

```
test/{unit,widget,golden}/...
integration_test/flows/...
```

## 8. Coverage

```bash
flutter test --coverage    # 产出 lcov.info
```

业务逻辑（domain + 状态管理）覆盖率目标 ≥ 80%，低于阈值阻断 CI。

## 9. Checklist

- [ ] 状态管理用 bloc_test / ProviderContainer，覆盖全部状态迁移。
- [ ] widget 行为有 widget 测，设计关键 UI 有 golden。
- [ ] 复杂依赖优先手写 fake；时间用 fake_async。
- [ ] 测试名描述行为，按 unit/widget/golden/integration 组织。
- [ ] 覆盖率达标并在 CI 阻断。
