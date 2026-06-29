# Rust Security Convention v1.0

> Applies to: 所有 Rust crate | Goal: 在通用安全基线上落实 Rust 的密钥、注入、unsafe 与依赖审计实践

For the full convention index, see [../../SKILL.md](../../SKILL.md).

在通用 [security.md](../security.md) 之上扩展。

## 1. Secret Management

```rust
use anyhow::Context;

fn load_api_key() -> anyhow::Result<String> {
    std::env::var("PAYMENT_API_KEY")
        .context("PAYMENT_API_KEY must be set")
}
```

- 密钥从 `std::env::var` 读取，缺失启动期 fail-fast；绝不硬编码。
- 敏感值用 `secrecy` crate 包装，避免误入日志 / Debug 输出。
- `.env` 必须 `.gitignore`；命名见 [configuration.md](../configuration.md)。

## 2. SQL Injection Prevention

用绑定参数（sqlx / diesel / sea-orm），绝不 `format!` 拼 SQL：

```rust
// Bad —— 注入
let q = format!("SELECT * FROM users WHERE name = '{name}'");

// Good —— 参数化（占位符随后端：Postgres $1 / MySQL ?）
sqlx::query("SELECT * FROM users WHERE name = $1")
    .bind(&name)
    .fetch_one(&pool)
    .await?;
```

## 3. Input Validation — Parse, Don't Validate

边界处把非结构化输入转成已校验类型（newtype），之后内部都合法：

```rust
pub struct Email(String);

impl Email {
    pub fn parse(input: &str) -> Result<Self, ValidationError> {
        // 校验后再构造；失败返回明确错误
        ...
    }
}
```

## 4. Unsafe Code

- **最小化** `unsafe`，优先安全抽象。
- 每个 `unsafe` 块 MUST 有 `// SAFETY:` 注释说明被依赖的不变量。
- 绝不用 `unsafe` 图省事绕过借用检查器；review 时 unsafe 是重点审查项。
- 对 C 库优先封装成安全 FFI wrapper。

```rust
let widget: &Widget = {
    // SAFETY: ptr 非空、对齐、指向已初始化 Widget，且其生命周期内无可变别名。
    unsafe { &*ptr }
};
```

## 5. Dependency Security

```bash
cargo audit          # 已知 CVE
cargo deny check     # 许可 / 公告合规
cargo tree -d        # 排查重复 / 传递依赖
```

- 锁文件入库，CI 阻断高危公告。
- 新增 crate 前评估必要性与维护状况，最小化依赖面。

## 6. Error Messages

- 对外响应**不**暴露内部路径、栈、数据库错误；映射为状态码 + 泛化 message。
- 服务端用 `tracing` 结构化记录详细错误（见 [observability.md](../observability.md)）。

## 7. Integer & Overflow

- 算术溢出在 debug 下 panic、release 下回绕；对不可信输入用 `checked_*` / `saturating_*` / `wrapping_*` 显式处理。

## 8. Checklist

- [ ] 密钥从环境读取、fail-fast，敏感值用 secrecy 包装。
- [ ] SQL 全绑定参数，无 `format!` 拼接。
- [ ] 边界 parse-don't-validate，用 newtype 收口。
- [ ] `unsafe` 最小化且每块有 `// SAFETY:` 注释。
- [ ] `cargo audit` + `cargo deny check` 通过。
- [ ] 对外错误泛化、不泄露内部；溢出显式处理。
