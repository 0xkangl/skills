# Rust Tooling Convention v1.0

> Applies to: 所有 Rust crate | Goal: 统一格式化、lint、构建、审计与测试工具，让本地与 CI 一致

For the full convention index, see [../../SKILL.md](../../SKILL.md).

风格见 [rust-style.md](rust-style.md)。本篇定工具链。

## 1. Toolchain

| 关注点 | 工具 | 命令 |
|---|---|---|
| 格式化 | **rustfmt** | `cargo fmt` |
| Lint | **clippy** | `cargo clippy -- -D warnings`（警告即错误） |
| 构建 / 测试 | **cargo** | `cargo build` / `cargo test` |
| 快速测试 | **cargo-nextest** | `cargo nextest run`（更快、更清晰输出） |
| 漏洞审计 | **cargo-audit** | `cargo audit`，见 [rust-security.md](rust-security.md) |
| 许可 / 公告 | **cargo-deny** | `cargo deny check` |
| 覆盖率 | **cargo-llvm-cov** | `cargo llvm-cov` |

## 2. Toolchain Pinning

- 用 `rust-toolchain.toml` 固定工具链版本与组件，保证团队与 CI 一致：

```toml
[toolchain]
channel = "1.81.0"
components = ["rustfmt", "clippy"]
```

## 3. Lint Configuration

- CI 中 `cargo clippy --all-targets --all-features -- -D warnings`，零警告通过。
- 必要时在 `Cargo.toml` 的 `[lints]` 表统一开启更严格的 lint：

```toml
[lints.rust]
unsafe_code = "warn"

[lints.clippy]
unwrap_used = "warn"
```

## 4. Build & Release

- `Cargo.lock` 入库（应用 crate；库 crate 可选）保证可复现。
- release 构建启用优化与 LTO（按需）；`cargo build --release`。
- feature flag 显式声明，避免隐式启用传递依赖的重 feature。

## 5. Unified Commands

借助 `cargo` 或 `Makefile` / `just` 提供统一入口：

```makefile
fmt:   ; cargo fmt
lint:  ; cargo clippy --all-targets -- -D warnings
test:  ; cargo nextest run
audit: ; cargo audit && cargo deny check
check: fmt lint test
```

## 6. Checklist

- [ ] `cargo fmt` + `cargo clippy -- -D warnings` 零警告。
- [ ] 工具链用 `rust-toolchain.toml` 固定。
- [ ] `Cargo.lock` 按 crate 类型决定是否入库。
- [ ] `cargo audit` + `cargo deny check` 通过。
- [ ] 提供统一命令入口。
