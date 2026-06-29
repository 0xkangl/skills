# Go Security Convention v1.0

> Applies to: 所有 Go 后端服务 | Goal: 在通用安全基线上落实 Go 的密钥、注入、context 超时与漏洞扫描实践

For the full convention index, see [../../SKILL.md](../../SKILL.md).

在通用 [security.md](../security.md) 之上扩展 Go 专项。错误处理与单一响应出口见 [go-error-handling.md](go-error-handling.md)，扫描工具见 [go-tools.md](go-tools.md)。

## 1. Secret Management

```go
apiKey := os.Getenv("PAYMENT_API_KEY")
if apiKey == "" {
    log.Fatal("PAYMENT_API_KEY not configured")
}
```

- 密钥从环境读取，缺失启动期 `log.Fatal` fail-fast；绝不硬编码。
- 命名与双前缀见 [configuration.md](../configuration.md)。
- 敏感值不进日志 / 不放入 `error` 文本（见 [observability.md](../observability.md)）。

## 2. SQL Injection Prevention

用参数化查询 / `sqlc` 生成的类型安全方法，**绝不** `fmt.Sprintf` 拼 SQL：

```go
// Bad —— 注入
q := fmt.Sprintf("SELECT * FROM users WHERE name = '%s'", name)

// Good —— 参数化
row := db.QueryRowContext(ctx, "SELECT * FROM users WHERE name = $1", name)
```

- 项目用 `sqlc` 时走生成方法，编译期保证查询与参数匹配（见 [go-tools.md](go-tools.md)）。

## 3. Context & Timeouts

所有跨边界调用（DB、HTTP、RPC）传 `context.Context` 并设超时，防止 goroutine 与连接泄露：

```go
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
defer cancel()
result, err := client.Do(ctx, req)
```

- HTTP server 设 `ReadTimeout` / `WriteTimeout` / `IdleTimeout`，不留默认无限。
- context 作为函数第一个参数透传，不存进 struct。

## 4. Input Validation

- 边界用 validator 校验请求（见 [go-validation.md](go-validation.md)）。
- 对用户提供的 URL（webhook、回调、图片地址）校验 scheme / host 防 SSRF。
- 文件路径拼接前 `filepath.Clean` 并校验限制在允许目录，防路径穿越。

## 5. Command Execution

```go
// Good —— 参数列表，无 shell 解释
cmd := exec.CommandContext(ctx, "convert", input, output)
```

不把用户输入拼进 shell；用 `exec.CommandContext` 传参数切片，必要时白名单校验。

## 6. Security Scanning

```bash
gosec ./...        # 静态安全分析
govulncheck ./...  # 依赖已知漏洞（见 go-tools.md）
```

- 二者纳入 CI，高危发现设为阻断项。
- `go.sum` 入库锁定依赖校验和。

## 7. Error Exposure

- 对外响应泛化错误 + 错误码，内部细节只进服务端日志（单一响应出口见 [go-error-handling.md](go-error-handling.md)）。
- 不把 `err.Error()` 原样返回客户端（可能含路径 / SQL / 内部结构）。

## 8. Checklist

- [ ] 密钥从环境读取、缺失 `log.Fatal`，不进日志 / error 文本。
- [ ] SQL 参数化 / sqlc，无 `Sprintf` 拼接。
- [ ] 跨边界调用传 context 并设超时；server 设各类 timeout。
- [ ] 边界校验输入，URL 校验防 SSRF，路径 `Clean` 防穿越。
- [ ] 命令用 `exec.CommandContext` 传参数切片，无 shell 拼接。
- [ ] `gosec` + `govulncheck` 纳入 CI 并阻断高危。
- [ ] 对外错误泛化，不暴露 `err.Error()` 内部细节。
