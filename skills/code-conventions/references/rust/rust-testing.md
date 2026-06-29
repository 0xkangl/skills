# Rust Testing Convention v1.0

> Applies to: 所有 Rust crate | Goal: 用内建测试 + rstest/proptest/mockall 覆盖业务逻辑，单测内联、集成测试独立

For the full convention index, see [../../SKILL.md](../../SKILL.md).

在通用 [testing.md](../testing.md) 之上扩展。

## 1. Framework & Layout

| 工具 | 用途 |
|---|---|
| `#[test]` + `#[cfg(test)]` | 单元测试（与源码同文件） |
| `rstest` | 参数化测试与 fixture |
| `proptest` | 属性测试 |
| `mockall` | 基于 trait 的 mock |
| `#[tokio::test]` | 异步测试 |

```text
my_crate/
├── src/lib.rs          # 单测在 #[cfg(test)] mod 内
│   └── orders/service.rs   # #[cfg(test)] mod tests { ... }
├── tests/              # 集成测试（每文件 = 独立 binary）
│   └── api_test.rs
└── benches/            # criterion 基准
```

单测放同文件 `#[cfg(test)]` 模块；集成测试放 `tests/`。

## 2. Unit Test Pattern

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_user_with_valid_email() {
        let user = User::new("Alice", "alice@example.com").unwrap();
        assert_eq!(user.name, "Alice");
    }

    #[test]
    fn rejects_invalid_email() {
        assert!(User::new("Bob", "not-an-email").is_err());
    }
}
```

测试名描述场景：`rejects_order_when_insufficient_stock`、`returns_none_when_not_found`。

## 3. Parameterized & Property

```rust
use rstest::rstest;

#[rstest]
#[case("hello", 5)]
#[case("", 0)]
fn string_length(#[case] input: &str, #[case] expected: usize) {
    assert_eq!(input.len(), expected);
}
```

- 多输入用 `rstest`，不复制测试体。
- 不变量 / 往返性质用 `proptest` 做属性测试（如 `parse(format(x)) == x`）。

## 4. Mocking

production 定义 trait，测试模块用 `mockall` 生成 mock；只 mock 外部边界，不 mock 被测自身：

```rust
#[test]
fn service_returns_user_when_found() {
    let mut mock = MockRepo::new();
    mock.expect_find_by_id()
        .with(eq(42))
        .returning(|_| Some(User { id: 42, name: "Alice".into() }));

    let service = UserService::new(Box::new(mock));
    assert_eq!(service.get_user(42).unwrap().name, "Alice");
}
```

## 5. Async & Doc Tests

- 异步测试用 `#[tokio::test]`。
- 公共 API 的文档示例即 **doc test**，`cargo test --doc` 验证示例不腐化。

## 6. Coverage

```bash
cargo llvm-cov                        # 摘要
cargo llvm-cov --fail-under-lines 80  # 低于阈值失败
```

业务逻辑覆盖率目标 ≥ 80%，排除生成代码与 FFI 绑定，关注分支与错误路径。

## 7. Checklist

- [ ] 单测内联 `#[cfg(test)]`，集成测试放 `tests/`，命名描述场景。
- [ ] 多输入用 rstest，不变量用 proptest。
- [ ] mock 仅限外部 trait 边界。
- [ ] 异步用 `#[tokio::test]`，公共 API 有 doc test。
- [ ] 覆盖率达标，关注分支与错误路径。
