# Go Error Handling Convention v1.0

> Applies to: All Go backend services | Goal: Unified error flow from service to HTTP response, no per-handler error mapping

Handler、Service、Repository 在本文中表示业务包内的职责，分别见 `internal/<业务名>/handler.go`、`service.go`、`repository.go`，不要求三个独立包。目录边界见 [go-project.md](go-project.md)。

## 目录

- [1. Design Philosophy](#1-design-philosophy)
- [2. Core Types](#2-core-types)
- [3. Predefined Sentinels](#3-predefined-sentinels)
- [4. Layered Error Flow](#4-layered-error-flow)
- [5. Response Layer — Single Write Point](#5-response-layer--single-write-point)
- [6. Stack Trace Rules](#6-stack-trace-rules)
- [7. Logging Integration](#7-logging-integration)
- [8. Testing Error Handling](#8-testing-error-handling)
- [9. Migration Guide (from old pattern)](#9-migration-guide-from-old-pattern)
- [10. Checklist](#10-checklist)

## 1. Design Philosophy

Go does not have exceptions. The community consensus is **not** to simulate Spring Boot's `@ControllerAdvice` pattern, but to embrace Go's value semantics:

> **Let the error carry full HTTP semantics. Let a single function write the response.**

This avoids:
- Duplicated `mapXxxErr()` functions in every handler group（每个 handler 组重复写错误映射）
- Stack traces captured at the log call site instead of the error origin site
- Inconsistent error response formats across endpoints

## 2. Core Types

### 2.1 `HTTPError` Interface

`internal/apperror` defines the `HTTPError` interface — the **only** error contract the HTTP layer needs to know:

```go
type HTTPError interface {
    error
    HTTPStatus() int           // HTTP 状态码（200, 400, 401, 500…）
    BusinessCode() int         // 业务错误码（1001, 2001, 5001…）
    UserMessage() string       // 面向用户的消息
    Details() string           // 面向开发者的详情（仅日志，不返给客户端）
    LogLevel() slog.Level      // 日志级别（5xx→Error, 4xx→Warn/Info）
    StackFrames() []StackFrame // 错误产生点结构化堆栈（nil=不记）
}
```

### 2.2 `AppError` — The Single Error Carrier

```go
type AppError struct {
    Status int            // HTTP status code
    Code   int            // Business error code
    Msg    string         // User-facing message
    Detail string         // Dev-facing details (logs only)
    Cause  error          // Wrapped original error
    Stack  []StackFrame   // Structured stack at error origin (runtime.Callers)
    Level  slog.Level     // Log level
}
```

**Key design:**

| Property | Behavior |
|----------|----------|
| Sentinel instances | Immutable — no `Cause`, no `Stack` |
| `.Wrap(cause)` | Returns a **copy** with `Cause` + structured stack captured at call site |
| `.WithMsg(msg)` | Returns a copy with overridden user message |
| `.WithDetail(detail)` | Returns a copy with appended dev detail |
| `.Is(target)` | Code-based matching — `errors.Is(ErrOTPCode.WithMsg("..."), ErrOTPCode)` → `true` |
| `.Unwrap()` | Returns `Cause` for `errors.Is` / `errors.As` chain traversal |

### 2.3 `StackFrame` — Structured Stack Trace

```go
type StackFrame struct {
    File     string `json:"file"`     // e.g. "internal/auth/otp.go"
    Line     int    `json:"line"`     // e.g. 167
    Function string `json:"function"` // e.g. "auth.(*Service).OTPLogin"
}
```

Stack traces are captured at the **error origin site** (where `.Wrap()` is called) using `runtime.Callers`, not at the log site. Only project code frames are kept; `runtime/` and `/go/pkg/mod/` frames are filtered.

## 3. Predefined Sentinels

All business error codes are predefined as exported sentinel `*AppError` variables in `internal/apperror`:

```go
// 1xxx — Validation
var ErrValidation = newAppError(400, 1001, "parameter error", slog.LevelInfo)

// 2xxx — Authentication
var ErrUnauthorized = newAppError(401, 2001, "not authenticated", slog.LevelWarn)
var ErrOTPCode      = newAppError(401, 2002, "invalid or expired code", slog.LevelWarn)
// … etc.

// 3xxx — Authorization
var ErrForbidden = newAppError(403, 3001, "forbidden", slog.LevelWarn)

// 4xxx — Resource / Business
var ErrNotFound       = newAppError(404, 4001, "resource not found", slog.LevelWarn)
var ErrUniqueConflict = newAppError(409, 4093, "unique constraint conflict", slog.LevelWarn)

// 5xxx — System / External
var ErrInternal = newAppError(500, 5001, "system error", slog.LevelError)
```

**Rules for adding new codes:**
- Each code MUST have exactly one sentinel in `internal/apperror`
- The sentinel's `Status` and `Code` are immutable
- The sentinel's `Level` determines whether it logs at Error (5xx) or Warn/Info (4xx)
- Service/handler code MUST NOT define additional sentinel errors — use `.WithMsg()` to customize the user message

## 4. Layered Error Flow

```
┌─────────────┐
│  Middleware  │  panic → ErrInternal.Wrap(...)
│  (auth, rl)  │  auth fail → ErrUnauthorized
│              │  rate limit → ErrOTPRateLimit
└──────┬───────┘
       ↓
┌─────────────┐
│   Handler    │  if err != nil {
│              │      response.Error(c, err)  ← 唯一出口
│              │      return
│              │  }
└──────┬───────┘
       ↓
┌─────────────┐
│   Service    │  if err != nil {
│              │      return nil, apperror.ErrOTPCode.Wrap(err)
│              │  }                        ↑ 堆栈在此捕获
└──────┬───────┘
       ↓
┌─────────────┐
│  Repository  │  if pgx.ErrNoRows {
│              │      return nil, apperror.ErrNotFound
│              │  }
└─────────────┘
```

### 4.1 Repository Layer

Return `apperror.Err*` sentinels directly for known conditions. For unexpected DB errors, return the raw error (service wraps it).

```go
// Good
func (r *PostgresStore) FindByID(ctx context.Context, id int64) (*User, error) {
    row, err := r.queries.GetUserByID(ctx, id)
    if errors.Is(err, pgx.ErrNoRows) {
        return nil, apperror.ErrNotFound  // sentinel, no stack needed
    }
    if err != nil {
        return nil, err  // raw error, service will wrap
    }
    return &User{ID: row.ID, Email: row.Email}, nil  // sqlc row → 本模块业务类型
}
```

**Legacy sentinel aliases:** While migrating old layer packages, aliases MAY temporarily preserve existing `errors.Is(err, repository.ErrNotFound)` checks:

```go
var ErrNotFound = apperror.ErrNotFound
var ErrDuplicateSMSTemplate = apperror.ErrUniqueConflict
```

These are compatibility aliases, not independent sentinels. New business-package code uses `apperror.Err*` directly; do not recreate a global repository package for aliases.

### 4.2 Service Layer

**This is where errors gain context.** Call `.Wrap(cause)` to capture the stack at the error origin:

```go
// Good — wrap with context, stack captured here
func (s *Service) OTPLogin(ctx context.Context, target, code string) (*LoginResult, error) {
    if !s.codes.Verify(ctx, target, code) {
        return nil, apperror.ErrOTPCode  // no cause → no stack (expected auth failure)
    }
    user, err := s.repo.FindByEmail(ctx, target)
    if err != nil {
        return nil, apperror.ErrInternal.Wrap(err)  // unexpected DB error → stack captured
    }
    return &LoginResult{User: user}, nil
}

// Good — customize message for same error code
func (s *Service) Create(ctx context.Context, name string) (*Result, error) {
    if s.isDuplicate(name) {
        return nil, apperror.ErrUniqueConflict.WithMsg("username already taken")
    }
    // ...
}

// Bad — DON'T define service-level sentinels
var ErrOTPCode = errors.New("invalid code")  // ❌ deleted by this convention
```

**Service error design rules:**
- Return `error` (not `*apperror.AppError`) in function signatures — stay idiomatic
- Use `.Wrap(cause)` when wrapping an underlying error that warrants a stack trace
- Use the sentinel directly (no `.Wrap()`) for expected business rejections (invalid OTP, not found, rate limited) — no stack overhead
- Use `.WithMsg()` to customize the user-facing message without changing the error code
- **Never** define `var ErrXxx = errors.New(...)` service-level sentinels

### 4.3 Handler Layer

The handler is **thin** — it parses the request, calls the service, and passes any error to `response.Error()`:

```go
// Good — single error pattern
func (h *Handler) OTPLogin(c *gin.Context) {
    var req otpLoginReq
    if !httpx.BindJSON(c, &req) {
        return  // httpx.BindJSON 已调用 response.Error
    }
    res, err := h.svc.OTPLogin(c.Request.Context(), req.Target, req.Code)
    if err != nil {
        response.Error(c, err)  // ← 唯一出口，无需 mapAuthErr()
        return
    }
    response.Success(c, res)
}

// Bad — DON'T map errors in handlers
func mapAuthErr(err error) *apperror.AppError {  // ❌ deleted by this convention
    switch {
    case errors.Is(err, auth.ErrOTPCode):
        return apperror.ErrOTPCode
    // ...
    }
}
```

**Handler error handling rules:**
- Each error path MUST be exactly: `response.Error(c, err)` + `return`
- **No** `mapXxxErr()` functions — the error already carries all HTTP semantics
- **No** `response.Error(c, apperror.ErrInternal, err)` three-argument calls — `err` IS already the right error
- Validation errors (binding failure, param parsing) use `apperror.ErrValidation.WithMsg(...)` directly

### 4.4 Middleware Layer

Middleware returns `apperror.Err*` sentinels. When wrapping raw system errors (Redis down, etc.), use `.Wrap(cause)`:

```go
// Good
func JWT(...) gin.HandlerFunc {
    return func(c *gin.Context) {
        // ...
        if cache.IsUnavailable(cch) {
            response.Error(c, apperror.ErrInternal.Wrap(cache.ErrUnavailable))
            return
        }
        if revoked {
            response.Error(c, apperror.ErrUnauthorized)
            return
        }
        c.Next()
    }
}
```

## 5. Response Layer — Single Write Point

`response.Error(c, err)` (in `internal/response`) is the **only** function that writes error responses. It accepts `error` and extracts `HTTPError`:

`HTTPError.Details()` is developer-facing and goes only to sanitized server logs. Client-visible field validation `details`, if needed, must be constructed from explicitly public validation data; never populate it from `HTTPError.Details()`. Sanitize error details and causes before logging, following [security.md](../security.md) and [observability.md](../observability.md).

```go
func Error(c *gin.Context, err error) {
    ctx := c.Request.Context()
    var httpErr apperror.HTTPError
    if !errors.As(err, &httpErr) {
        // Non-HTTPError → fallback to 500 with stack
        httpErr = apperror.ErrInternal.Wrap(err)
    }

    // Details and wrapped causes must already be sanitized before reaching this point.
    slog.Log(ctx, httpErr.LogLevel(), "request: failed",
        "errorCode", httpErr.BusinessCode(),
        "error", err,
        "detail", httpErr.Details(),
        "stackTrace", httpErr.StackFrames(), // structured, not raw string
    )

    c.AbortWithStatusJSON(httpErr.HTTPStatus(), ErrorResponse{
        Code:    httpErr.BusinessCode(),
        Message: httpErr.UserMessage(),
    })
}
```

## 6. Stack Trace Rules

| Error type | Capture stack? | Why |
|------------|---------------|-----|
| Expected auth failure (invalid OTP, wrong password) | No | Expected behavior, not a bug |
| Resource not found (404) | No | Normal operation |
| Rate limit (429) | No | Expected throttling |
| Validation failure (400) | No | Client error |
| DB connection failure | Yes | Infrastructure bug — needs investigation |
| Third-party service failure (502) | Yes | External dependency issue — needs investigation |
| Unexpected nil / invariant violation (500) | Yes | Code bug — needs investigation |
| Panic (Recovery middleware) | Yes | Defect — must be fixed |

In practice: sentinels with `Level >= slog.LevelError` (5xx) SHOULD use `.Wrap(cause)` to capture stack. Sentinels with `Level < slog.LevelError` (4xx) SHOULD be returned directly without `.Wrap()`.

## 7. Logging Integration

The project's logger (e.g. `internal/logger`) works with `AppError` automatically:

- `logger.ErrorCtx(ctx, ...)` accepts `err error` — the error is logged as `"error"` key
- If the error implements `HTTPError`, `response.Error()` logs stack trace as structured `"stackTrace"` array
- **Do NOT** call `debug.Stack()` manually — stack traces belong to the error, not the log call site
- For non-response error logging (startup, background jobs), use `apperror.ErrInternal.Wrap(err)` to attach a stack before passing to `logger.ErrorCtx`

## 8. Testing Error Handling

### 8.1 Testing Services

```go
func TestOTPLogin_InvalidCode(t *testing.T) {
    // Service returns *apperror.AppError implementing error
    _, err := svc.OTPLogin(ctx, "test@example.com", "000000")
    assert.Error(t, err)

    // errors.Is works via AppError.Is() → code-based matching
    assert.ErrorIs(t, err, apperror.ErrOTPCode)

    // Can also extract HTTP semantic via errors.As
    var httpErr apperror.HTTPError
    require.True(t, errors.As(err, &httpErr))
    assert.Equal(t, 401, httpErr.HTTPStatus())
}
```

### 8.2 Testing Handlers

```go
func TestHandler_ErrorResponse(t *testing.T) {
    w := httptest.NewRecorder()
    c, _ := gin.CreateTestContext(w)
    c.Request = httptest.NewRequest("POST", "/v1/auth/otp/login", body)

    h.OTPLogin(c)

    assert.Equal(t, http.StatusUnauthorized, w.Code)
    var resp response.ErrorResponse
    json.Unmarshal(w.Body.Bytes(), &resp)
    assert.Equal(t, 2002, resp.Code)
}
```

## 9. Migration Guide (from old pattern)

When migrating an existing Go service to this convention:

1. **Update the shared error package** — New services use `internal/apperror`; preserve existing public `pkg/apperror` contracts when applicable. Add `HTTPError`, `AppError` and `Wrap`/`WithMsg`/`WithDetail`/`Is`/`Unwrap`
2. **Add `apperror/stack.go` in that package** — `captureStack()` using `runtime.Callers`
3. **Update `response.Error()`** — Accept `error`, extract `HTTPError` via `errors.As`; new services use `internal/response`
4. **Remove duplicate business sentinels** — Replace `var ErrXxx = errors.New(...)` in module business logic with the shared error definitions
5. **Update service returns** — Replace `return nil, ErrOTPCode` with `return nil, apperror.ErrOTPCode`
6. **Delete handler `mapXxxErr()`** — Replace `response.Error(c, mapAuthErr(err), err)` with `response.Error(c, err)`
7. **Update middleware** — Replace `response.Error(c, apperror.ErrInternal, cause)` with `response.Error(c, apperror.ErrInternal.Wrap(cause))`
8. **Preserve old callers if needed** — Add temporary aliases in existing layer packages; remove them after callers migrate, without adding aliases to new business packages
9. **Update tests** — Replace sentinel references with `apperror.Err*`

## 10. Checklist

Before merging any Go code, verify:

- [ ] No duplicate business sentinels in module business logic; use shared `apperror.Err*`
- [ ] No `mapXxxErr()` functions in module HTTP adapters
- [ ] All `response.Error()` calls use the **single-argument** pattern: `response.Error(c, err)`
- [ ] `.Wrap(cause)` is used at the error **origin** site (service/ middleware), not at the log site
- [ ] `debug.Stack()` is **never** called directly — use `apperror.ErrXxx.Wrap(cause)` instead
- [ ] `errors.Is(err, sentinel)` checks work via `AppError.Is()` code-based matching
- [ ] New error codes have a single sentinel in the shared error package (`internal/apperror` for new services)
- [ ] 5xx errors use `.Wrap(cause)` to capture stack; 4xx errors return sentinel directly
- [ ] Developer-facing `Details()` and stack frames stay in sanitized server logs; client responses contain only public messages and explicitly public validation data
