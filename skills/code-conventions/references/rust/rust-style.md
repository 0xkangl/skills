# Rust Style and Idioms Convention v1.0

> Applies to: 所有 Rust crate | Goal: 写出地道、安全、零成本抽象的 Rust——所有权清晰、错误显式、用类型表达不变量

For the full convention index, see [../../SKILL.md](../../SKILL.md).

在通用 [coding-style.md](../coding-style.md) 与 [patterns.md](../patterns.md) 之上扩展。工具见 [rust-tools.md](rust-tools.md)，测试见 [rust-testing.md](rust-testing.md)，安全见 [rust-security.md](rust-security.md)。

## 1. Formatting

- 提交前 `cargo fmt`（rustfmt）；4 空格缩进，行宽 100（rustfmt 默认）。
- `cargo clippy -- -D warnings` 把 lint 警告当错误，见 [rust-tools.md](rust-tools.md)。

## 2. Naming

- `snake_case`：函数、方法、变量、模块、crate。
- `PascalCase`：类型、trait、枚举、类型参数。
- `SCREAMING_SNAKE_CASE`：常量与 static。
- 生命周期短小写（`'a`、`'de`），复杂场景用描述名（`'input`）。

## 3. Immutability

Rust 默认不可变，顺势而为：

- 默认 `let`，仅在确需修改时 `let mut`。
- 优先返回新值而非原地修改。
- 可能分配也可能不分配时用 `Cow<'_, T>`。

```rust
use std::borrow::Cow;

fn normalize(input: &str) -> Cow<'_, str> {
    if input.contains(' ') {
        Cow::Owned(input.replace(' ', "_"))
    } else {
        Cow::Borrowed(input)
    }
}
```

## 4. Ownership & Borrowing

- 默认借用（`&T`），仅在需存储 / 消费时取所有权。
- **绝不**为了哄过借用检查器而无脑 `clone()`——先理解根因。
- 入参用 `&str` 而非 `String`、`&[T]` 而非 `Vec<T>`；构造函数需拥有 `String` 时用 `impl Into<String>`。

```rust
fn word_count(text: &str) -> usize {
    text.split_whitespace().count()
}

fn new(name: impl Into<String>) -> Self {
    Self { name: name.into() }
}
```

## 5. Error Handling

- 用 `Result<T, E>` + `?` 传播；**生产代码禁 `unwrap()`**。
- **库**：用 `thiserror` 定义类型化错误。
- **应用**：用 `anyhow` 灵活附加上下文（`.with_context(|| ...)`）。
- `unwrap()` / `expect()` 仅用于测试与真正不可达的状态。

```rust
#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("failed to read config: {0}")]
    Io(#[from] std::io::Error),
    #[error("invalid config format: {0}")]
    Parse(String),
}
```

## 6. Iterators Over Loops

转换用迭代器链（声明式、可组合），复杂控制流 / 早返回用循环：

```rust
let active_emails: Vec<&str> = users.iter()
    .filter(|u| u.is_active)
    .map(|u| u.email.as_str())
    .collect();
```

## 7. Type-Driven Design

让非法状态无法表示，见 [patterns.md](../patterns.md)：

- **newtype** 区分同底层类型的不同语义，防参数错位：`struct UserId(u64); struct OrderId(u64);`。
- **enum 状态机**建模有限状态，`match` 穷尽处理，业务关键枚举不用通配 `_`。
- **parse, don't validate**：边界处把非结构化输入转成已校验的类型，之后内部都是合法值。
- **builder** 处理多可选参数；**sealed trait**（私有 supertrait）控制外部实现。

```rust
enum ConnectionState {
    Disconnected,
    Connecting { attempt: u32 },
    Connected { session_id: String },
    Failed { reason: String, retries: u32 },
}
```

## 8. Module Organization & Visibility

- 按领域组织模块（`auth/`、`orders/`、`db/`），不按类型堆放。
- 默认私有；内部共享用 `pub(crate)`，仅公共 API 标 `pub`。
- 从 `lib.rs` re-export 公共 API。

## 9. Structure & DI

- trait 定义在使用处、保持小接口；依赖经构造函数注入（`Box<dyn Trait>` / 泛型）。
- trait 加 `Send + Sync` 约束以便跨线程共享，见 [patterns.md](../patterns.md)。

## 10. Checklist

- [ ] `cargo fmt` + `cargo clippy -- -D warnings` 全绿。
- [ ] 命名遵循 snake/Pascal/SCREAMING 约定。
- [ ] 默认 `let` 不可变、默认借用，无无脑 `clone()`。
- [ ] `Result` + `?` 传播，生产代码无 `unwrap()`；库用 thiserror / 应用用 anyhow。
- [ ] 转换用迭代器链。
- [ ] 用 newtype / enum 状态机 / parse-don't-validate 表达不变量。
- [ ] 模块按领域组织，默认私有可见性。
