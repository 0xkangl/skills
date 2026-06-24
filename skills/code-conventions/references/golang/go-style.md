# Go Style and Idioms Convention v1.0

> Applies to: All Go backend services | Goal: Standardize idiomatic Go code style, naming, and patterns

This document distills mandatory and recommended practices from [Effective Go](https://go.dev/doc/effective_go) and aligns them with this project's layered architecture. It complements [go-project.md](go-project.md) (layout), [go-tools.md](go-tools.md) (formatting/lint), [go-testing.md](go-testing.md) (tests), and [go-validation.md](go-validation.md) (request validation).

**Note:** Effective Go predates generics and Go modules. Where this document or project conventions conflict with Effective Go, follow this document and the linked project conventions.

## 1. Formatting and Comments

### 1.1 Formatting

- All Go code MUST be formatted with `gofmt` / `goimports` before commit. See [go-tools.md](go-tools.md) §3.2 (`make fmt`).
- Use **tabs** for indentation; do not use spaces for indentation.
- Go has no line-length limit. Wrap long lines and indent continuation lines with an extra tab when readability suffers.
- Control structures (`if`, `for`, `switch`, `select`) do **not** use parentheses around conditions.
- The opening brace of a control structure MUST be on the **same line** as the keyword — never on the next line (semicolon insertion rules).

```go
// Good
if err != nil {
    return err
}

// Bad — semicolon insertion breaks this
if err != nil
{
    return err
}
```

### 1.2 Comments

- Prefer `//` line comments. Use `/* */` block comments only for package comments or disabling large code blocks.
- Comments immediately before top-level declarations (no blank line between) are **doc comments** and MUST document exported symbols.
- Every exported type, function, method, and package-level variable MUST have a doc comment. Enforced by `revive` (see [go-tools.md](go-tools.md) §2.2).

## 2. Naming

### 2.1 General Rules

- Use `MixedCaps` or `mixedCaps` for multi-word names. **Do not** use `snake_case` in Go identifiers (SQL/JSON tags are separate).
- Visibility is determined by the first character: uppercase = exported, lowercase = unexported.
- Prefer short, concise names. A helpful doc comment is often better than an overly long identifier.

### 2.2 Packages

- Package names MUST be **lowercase, single-word** — no underscores or `mixedCaps`.
- The package name SHOULD match the base name of its directory (e.g. directory `repository` → `package repository`).
- Do **not** use `import .` except in tests when strictly necessary.

### 2.3 Types and Functions

- Exported types in a package SHOULD avoid repeating the package name in the type name (e.g. `bufio.Reader`, not `bufio.BufReader`).
- Constructors SHOULD be named `New` or `New<Type>` when the package has multiple constructible types (e.g. `NewServer`, `NewUserRepository`).
- **Getters:** Do not use `Get` in getter names. For field `owner`, the getter is `Owner()`, not `GetOwner()`. Setters, when needed, use `SetOwner()`.

### 2.4 Interfaces

- One-method interfaces SHOULD be named with the method name plus `-er` suffix: `Reader`, `Writer`, `Handler`.
- If a method matches a well-known interface (`Read`, `Write`, `Close`, `String`, etc.), use the **same name and signature** — do not invent `ToString` when `String` is intended.
- Prefer **small interfaces** defined by the consumer. Accept interfaces, return structs.

### 2.5 Project-Specific Naming

| Kind | Convention | Example |
|------|------------|---------|
| Handler methods | Verb + resource | `CreateUser`, `GetUser` |
| Service methods | Business verb | `RegisterUser`, `Authenticate` |
| Repository methods | Data access verb | `FindByID`, `Create`, `Update` |
| Request DTOs (handler) | `<action>Request` (unexported) | `createUserRequest` |
| Domain types | Singular noun | `User`, `Order` |
| Errors (sentinel) | `Err` prefix | `ErrNotFound`, `ErrDuplicateEntry` |

See [go-project.md](go-project.md) for directory and layer placement.

## 3. Control Flow

### 3.1 Error Handling Style

- Check errors immediately after the call that produces them.
- Prefer **early return** on error; omit unnecessary `else` when the `if` body ends in `return`, `break`, `continue`, or `goto`.

```go
f, err := os.Open(name)
if err != nil {
    return err
}
defer f.Close()
// use f — success path continues downward
```

- Reuse `err` in the same scope with `:=` when at least one other variable is newly declared:

```go
d, err := f.Stat()
if err != nil {
    return err
}
```

- **Never** discard errors with `_` unless the failure is truly irrelevant and documented. See §6.1.

### 3.2 `if` Initialization

Use the `if` init statement for scoped temporaries (especially error checks):

```go
if err := file.Chmod(0664); err != nil {
    return err
}
```

### 3.3 `for` and `range`

- Use `for` for all loops; there is no `while` or `do-while`.
- Use `range` for slices, maps, strings, and channels.
- Use `_` to discard unused `range` values: `for _, v := range items`.

### 3.4 `switch`

- `switch` cases do not fall through by default.
- Use a **tagless** `switch` to replace long `if`-`else` chains when readability improves.
- Use comma-separated cases for multiple values: `case ' ', '?', '&':`.

## 4. Functions and Methods

### 4.1 Multiple Return Values

- Functions that can fail MUST return `(result, error)` or `error` alone — never use sentinel values like `-1` for errors.
- The `error` return MUST be the **last** return value.

### 4.2 Named Result Parameters

- Use named results sparingly — when they clarify meaning or enable a bare `return` in a short function (e.g. `ReadFull`-style loops).
- Do not use named results solely to avoid declaring local variables.

### 4.3 `defer`

- Use `defer` for cleanup paired with acquisition: `Close()`, `Unlock()`, rollback, etc. Place `defer` immediately after a successful open/lock.
- Remember: deferred calls run in **LIFO** order; arguments are evaluated when `defer` is **registered**, not when it runs.
- Do not rely on `defer` in hot loops where allocation or defer overhead matters; prefer explicit cleanup in tight loops.

### 4.4 Receivers: Pointer vs Value

- Use a **pointer receiver** when the method mutates the receiver or the receiver is a large struct.
- Use a **value receiver** when the method is read-only and the receiver is small.
- Be consistent within a type: if any method needs a pointer receiver, prefer pointer receivers for all methods on that type.
- A type with pointer methods implements an interface only for pointer values unless value methods also exist.

## 5. Data and Types

### 5.1 Zero Values

- Design types so the **zero value is useful** when possible (`bytes.Buffer`, `sync.Mutex`).
- Prefer `var buf bytes.Buffer` or composite literals over unnecessary `new()` / constructors when the zero value suffices.

### 5.2 `new` vs `make` vs Composite Literals

| Construct | Use for |
|-----------|---------|
| `make` | Slices, maps, channels (initialized, ready to use) |
| Composite literal `T{...}` or `&T{...}` | Structs, slices, maps, arrays with known fields |
| `new(T)` | Rare; prefer `&T{}` for pointers to structs |

```go
// Idiomatic
v := make([]int, 0, 100)
m := make(map[string]int)
ch := make(chan struct{}, 10)

// Not idiomatic for slices
var p *[]int = new([]int)
```

### 5.3 Slices

- Prefer slices over arrays in APIs unless a fixed size is required.
- Always check `len` before indexing; or use `range`.
- `append` may reallocate — always assign the result: `s = append(s, item)`.
- Preallocate with `make([]T, 0, capacity)` when the approximate size is known.

### 5.4 Maps

- Use the **comma-ok** idiom to distinguish missing keys from zero values:

```go
if v, ok := m[key]; ok {
    use(v)
}
```

- Use `delete(m, key)` to remove entries; deleting a missing key is safe.
- Initialize maps with `make` before writing; never assign to a `nil` map.

### 5.5 Embedding

- Use struct embedding to compose behavior, not for type hierarchies. Embedded fields' methods promote to the outer type.
- Resolve name conflicts explicitly — the outer type's fields/methods dominate embedded ones.
- Prefer embedding small, focused types (e.g. `*log.Logger` in a `Job` struct) over deep embedding chains.

## 6. Errors

This section covers Go-language error idioms: value semantics, wrapping, and panic discipline. The project's end-to-end error flow (the `HTTPError` interface, `AppError` carrier, layered handling, single response exit) is specified in [go-error-handling.md](go-error-handling.md).

### 6.1 Error Values

- Return `error` as the last value; return `nil` on success.
- Error strings SHOULD be lowercase and without trailing punctuation (unless proper nouns); they are often wrapped: `fmt.Errorf("open config: %w", err)`.
- Use `%w` for wrapping when callers need `errors.Is` / `errors.As`. Enforced by `errorlint` (see [go-tools.md](go-tools.md)).
- Provide context in wrap messages: operation + cause (`"create user: %w"`, not `"error"`).

### 6.2 Sentinel and Typed Errors

- Package-level sentinel errors use `Err` prefix: `var ErrNotFound = errors.New("not found")`.
- Typed errors (e.g. with extra fields) implement `Error() string` and are inspected with `errors.As`.
- End-to-end error flow (repository → service → handler → `response.Error()`) and the `pkg/apperror` `AppError` / `HTTPError` design are specified in [go-error-handling.md](go-error-handling.md). Handlers MUST NOT map errors (no `mapXxxErr()`); errors carry their own HTTP semantics.

### 6.3 Prohibited Patterns

- ❌ `fi, _ := os.Stat(path)` — never ignore errors
- ❌ `panic` for normal control flow in libraries or handlers
- ❌ String comparison on `err.Error()` for branching — use `errors.Is` / `errors.As`

### 6.4 `panic` and `recover`

- `panic` is for unrecoverable programmer errors or failed invariants during **initialization** only.
- HTTP handlers MUST NOT panic into the client; use middleware recovery at the server boundary (see [go-project.md](go-project.md)).
- `recover` is only valid inside deferred functions — typically in top-level goroutine wrappers or server middleware.
- Do not expose `panic` across package boundaries; convert to `error` at API edges (Effective Go `Compile` pattern).

## 7. Interfaces and Composition

### 7.1 Interface Design

- Define interfaces where they are **consumed** (handler/service), not where they are implemented (repository).
- Keep interfaces small (1–3 methods). Large interfaces are harder to mock and violate ISP.
- Constructors that exist only to satisfy an interface MAY return the interface type (e.g. `func NewHasher() hash.Hash`).

### 7.2 Compile-Time Interface Checks

When a type must satisfy an interface and no static conversion exists elsewhere, add a compile-time assertion:

```go
var _ http.Handler = (*UserHandler)(nil)
```

Use sparingly — only when breakage must be caught at compile time (e.g. code generation, external interfaces).

### 7.3 Type Assertions

- Prefer **comma-ok** form: `v, ok := x.(Type)` — never bare `x.(Type)` on values that may fail.
- Use type switches when handling multiple concrete types behind `interface{}` / `any`.

## 8. Concurrency

### 8.1 Principles

- **Do not communicate by sharing memory; share memory by communicating** — prefer channels or `sync` primitives over unsynchronized shared state.
- Every goroutine MUST have a clear exit path; avoid leaked goroutines.
- Use `context.Context` for cancellation and deadlines in service/repository APIs.

### 8.2 Goroutines

- Capture loop variables correctly in goroutines — in Go 1.22+ per-iteration loop variables are defined; in older code, copy `i := i` inside the loop body.
- Do not call `t.Fatal` / `t.Fatalf` from goroutines in tests — see [go-testing.md](go-testing.md) §12.

### 8.3 Synchronization

- Protect shared mutable state with `sync.Mutex` / `sync.RWMutex` or atomic types when channels are awkward (e.g. reference counts).
- Run tests with `-race` in CI: `go test -race ./...` (see [go-testing.md](go-testing.md) §9).

### 8.4 Server and Handler Concurrency

- Handlers MUST be safe for concurrent invocation by `net/http`.
- Long-running work SHOULD respect `r.Context()` cancellation.
- Limit concurrent work with buffered channels or worker pools when handling bursty load — do not spawn unbounded goroutines per request.

## 9. Initialization

### 9.1 Package `init`

- Avoid complex logic in `init` functions. Prefer explicit `New*` constructors called from `main`.
- Do not depend on `init` ordering across packages except for registration patterns (e.g. `database/sql` drivers) documented in the package.
- Side-effect imports (`import _ "package"`) MUST include a comment explaining why (e.g. driver registration).

### 9.2 `main`

- `cmd/server/main.go` wires dependencies only: config → database → server → signal handling. No business logic in `main`.

## 10. Blank Identifier

- Use `_` to discard unused `range` indices, map values when checking presence, or intentionally ignored returns when safe and documented.
- Never use `_` to silence unused imports or variables in committed code — remove them instead.
- Do not use blank-identifier hacks (`_ = x`) to bypass the compiler in production code.

## 11. Logging and Printing

- Production code uses structured logging per [observability.md](../observability.md) — not `fmt.Print*` for operational logs.
- `fmt.Errorf` is for constructing error values, not user-facing messages.
- Implement `String() string` (not `ToString`) for debug-friendly custom types; avoid infinite recursion in `String()` by not formatting the receiver as `%s` directly — convert to base type first.

## 12. Prohibited Patterns (Summary)

| Pattern | Reason |
|---------|--------|
| Ignored errors (`_, err` or `_, _`) | Hides failures; use explicit handling |
| `panic` in handlers/services | Use errors; recover at server boundary |
| `GetFoo()` getters | Non-idiomatic; use `Foo()` |
| `snake_case` identifiers | Use MixedCaps |
| `import .` | Pollutes namespace |
| Mutable package-level state without sync | Data races |
| Bare type assertion `x.(T)` | Panics on failure |
| Business logic in `init` or `main` | Breaks testability and layering |

## 13. Related Conventions

| Topic | Document |
|-------|----------|
| Project layout and layers | [go-project.md](go-project.md) |
| Formatting, lint, Makefile | [go-tools.md](go-tools.md) |
| Tests and mocks | [go-testing.md](go-testing.md) |
| Request validation | [go-validation.md](go-validation.md) |
| HTTP errors and envelopes | [http-constitution.md](../http-constitution.md) |
| Structured logging | [observability.md](../observability.md) |
| Error code registry | [error-codes.md](../error-codes.md) |
| End-to-end error flow | [go-error-handling.md](go-error-handling.md) |
