# Go Testing Convention v1.0

> Applies to: All Go backend services | Goal: Standardize Go-specific testing patterns, tools, and implementation details

This document is a companion to [testing.md](../testing.md) (the generic testing convention) and [go-style.md](go-style.md) (idioms and error handling). It defines Go-specific rules and patterns that all Go services MUST follow.

## 1. Test File Organization

```
internal/
├── handler/
│   ├── user.go
│   └── user_test.go          # Unit tests for handler logic
├── service/
│   ├── user.go
│   └── user_test.go          # Unit tests for business logic
├── repository/
│   ├── user.go
│   └── user_test.go          # Unit tests only (mocked DB)
├── middleware/
│   ├── auth.go
│   └── auth_test.go
pkg/
├── validator/
│   ├── validator.go
│   └── validator_test.go
tests/
├── integration/              # Integration tests that need real DB / HTTP server
│   ├── user_test.go
│   └── testutil.go
└── e2e/                      # End-to-end tests
    └── user_flow_test.go
```

**Rules:**

- Test files are co-located with source files using `_test.go` suffix (standard Go convention).
- Integration and E2E tests go in `tests/integration/` and `tests/e2e/` respectively — never co-located with unit tests.
- Files under `tests/integration/` and `tests/e2e/` MUST declare the corresponding build tag (see §7.1).
- Shared test helpers go in `testutil.go` within the same package or in `tests/integration/testutil.go` for cross-package helpers.
- Coverage thresholds and CI expectations are defined in [testing.md](../testing.md) §9–§11.

## 2. Naming Conventions

### 2.1 Test Functions

Use descriptive names that state the **scenario and expected outcome**:

```
Test<FunctionName>_<Scenario>_<ExpectedResult>
```

```go
func TestCreateUser_DuplicateEmail_ReturnsConflict(t *testing.T)
func TestCreateUser_ValidInput_ReturnsCreated(t *testing.T)
func TestCreateUser_MissingRequiredField_ReturnsValidationError(t *testing.T)
```

### 2.2 Sub-tests (t.Run)

Use `t.Run` for grouped scenarios within a test function:

```go
func TestParsePageSize(t *testing.T) {
    t.Run("returns default when empty", func(t *testing.T) { ... })
    t.Run("returns parsed value for valid input", func(t *testing.T) { ... })
    t.Run("returns error for negative value", func(t *testing.T) { ... })
}
```

## 3. Table-Driven Tests

For testing multiple scenarios of the same function, use table-driven tests:

```go
func TestValidateEmail(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        wantErr bool
    }{
        {"valid email", "user@example.com", false},
        {"missing @", "userexample.com", true},
        {"empty string", "", true},
        {"missing domain", "user@", true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := ValidateEmail(tt.input)
            if (err != nil) != tt.wantErr {
                t.Errorf("ValidateEmail(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
            }
        })
    }
}
```

**Rules:**

- Use `t.Run` for each case — enables parallel execution and clear failure identification.
- Each test case must have a descriptive `name` field.
- Use this pattern when there are ≥ 3 scenarios for the same function.

## 4. Mocking

### 4.1 Interface-Based Mocking

Define interfaces for all external dependencies. Accept interfaces, return structs:

```go
type UserRepository interface {
    Create(ctx context.Context, user *User) (*User, error)
    FindByEmail(ctx context.Context, email string) (*User, error)
}
```

### 4.2 Mock Structs

Use function-field mocks for simple cases:

```go
type MockUserRepo struct {
    CreateFunc    func(ctx context.Context, user *User) (*User, error)
    FindByEmailFunc func(ctx context.Context, email string) (*User, error)
}

func (m *MockUserRepo) Create(ctx context.Context, user *User) (*User, error) {
    return m.CreateFunc(ctx, user)
}

func (m *MockUserRepo) FindByEmail(ctx context.Context, email string) (*User, error) {
    return m.FindByEmailFunc(ctx, email)
}
```

For complex interfaces with many methods, use generated mocks (e.g., `mockgen`, `moq`).

### 4.3 Rules

- Never mock the module under test — mock its dependencies only.
- Mock structs live in the same `_test.go` file or in `testutil.go` if shared across test files.
- Do not export mock types — they are test-only.

## 5. HTTP Handler Testing

### 5.1 Unit Tests

Use `httptest.NewRecorder` + `httptest.NewRequest` to test handlers without starting a real server:

```go
func TestCreateUserHandler_ValidRequest_Returns201(t *testing.T) {
    // Arrange
    body := strings.NewReader(`{"email":"test@example.com","nickname":"tester"}`)
    req := httptest.NewRequest(http.MethodPost, "/v1/users", body)
    req.Header.Set("Content-Type", "application/json")
    rec := httptest.NewRecorder()

    handler := NewUserHandler(&MockUserService{})

    // Act
    handler.CreateUser(rec, req)

    // Assert
    assert.Equal(t, http.StatusCreated, rec.Code)

    var resp response.Response
    err := json.NewDecoder(rec.Body).Decode(&resp)
    require.NoError(t, err)
    assert.Equal(t, 0, resp.Code)
}
```

### 5.2 Assertions on HTTP Responses

Always assert (see [HTTP Constitution](../http-constitution.md)):

1. **Status code** — matches the spec.
2. **Response structure** — follows the standard envelope (`code`, `message`, `data`).
3. **Business error code** — matches the expected code in [error-codes.md](../error-codes.md).
4. **Field values** — key business fields are correct.

## 6. Error Testing

When testing error paths:

```go
func TestCreateUser_DuplicateEmail_ReturnsConflictError(t *testing.T) {
    repo := &MockUserRepo{
        CreateFunc: func(ctx context.Context, u *User) (*User, error) {
            return nil, errs.ErrDuplicateEntry
        },
    }
    svc := NewUserService(repo)

    _, err := svc.CreateUser(context.Background(), &CreateUserReq{
        Email: "dup@example.com",
    })

    require.Error(t, err)
    var appErr *apperror.AppError
    require.ErrorAs(t, err, &appErr)
    assert.Equal(t, errs.ErrDuplicateEntry.Code, appErr.Code)
}
```

**Rules:**

- Assert the **error type** or **error code**, not the error message string (messages may change).
- Use `require.Error` for "must fail" and `assert.Error` for "may fail".
- Always test the error code returned to the client matches [error-codes.md](../error-codes.md).

## 7. Integration Tests

### 7.1 Build Tags

Separate integration and E2E tests using build tags at the top of each file in `tests/integration/` or `tests/e2e/`:

```go
//go:build integration

package integration_test
```

```go
//go:build e2e

package e2e_test
```

Run with:

```bash
go test -tags=integration ./tests/integration/...
go test -tags=e2e ./tests/e2e/...
```

The default `go test ./...` (and `make test`) MUST NOT include tagged integration or E2E tests.

### 7.2 Database Handling

- Use test containers (Docker) or an ephemeral database for integration tests.
- Each test suite runs in a transaction that is rolled back after the test — no test persists data.
- Alternatively, truncate all tables before each test suite (not between every test — too slow).

### 7.3 Environment

- Integration tests MUST NOT require manual setup (e.g., manually starting a database).
- Provide a `docker-compose.test.yml` or use test containers that auto-provision dependencies.
- CI pipelines run integration tests; local runs are opt-in.

## 8. Test Data Factories

Use factory functions with optional overrides:

```go
func newUser(t *testing.T, overrides ...func(*User)) *User {
    t.Helper()
    u := &User{
        ID:       1,
        Email:    "test@example.com",
        Nickname: "tester",
    }
    for _, o := range overrides {
        o(u)
    }
    return u
}

// Usage
user := newUser(t, func(u *User) { u.Email = "other@example.com" })
```

**Rules:**

- Factory functions call `t.Helper()` so failures point to the calling test line.
- Default values must be valid and self-consistent.
- Never use production data or hard-coded magic values.

## 9. Concurrency Testing

For code with goroutines, channels, or shared state:

- Use `-race` flag in CI: `go test -race ./...`
- Test concurrent access with `sync.WaitGroup` or `t.Parallel()`.
- Never use `time.Sleep` to synchronize goroutines in tests — use channels or `sync` primitives.

## 10. Makefile Targets

Every Go service Makefile MUST provide the targets defined in [testing.md](../testing.md) §11.1 and [go-tools.md](go-tools.md) §3:

```makefile
.PHONY: test test-cover test-integration test-e2e fmt lint govulncheck check

test:              ## Run unit tests only
	go test ./...

test-cover:        ## Run unit tests with coverage report
	go test -coverprofile=coverage.out ./...
	go tool cover -func=coverage.out

test-integration:  ## Run integration tests (requires Docker / DB)
	go test -tags=integration ./tests/integration/...

test-e2e:          ## Run end-to-end tests
	go test -tags=e2e ./tests/e2e/...

fmt:               ## Format code (goimports)
	goimports -w .

lint:              ## Run linter (golangci-lint)
	golangci-lint run ./...

govulncheck:       ## Scan dependencies for known CVEs
	govulncheck ./...

check: fmt lint govulncheck test
```

See [go-tools.md](go-tools.md) for `dev`, `migrate-*`, `tools`, `tools-check`, and `release-check` targets.

## 11. Coverage Commands

```bash
# Full coverage report
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html

# Coverage for a specific package
go test -coverprofile=coverage.out ./internal/service/...

# Coverage with race detection
go test -race -coverprofile=coverage.out ./...
```

## 12. Prohibited Patterns

- ❌ Using `time.Sleep` to wait for async results (use channels, `sync` primitives, or polling with timeout)
- ❌ Mocking the struct under test instead of its dependencies
- ❌ Testing unexported functions by placing tests in the same package solely for access (test through exported API whenever possible; same-package tests are acceptable when the exported API provides no way to trigger the internal path)
- ❌ Using `t.Fatal` / `t.Fatalf` in goroutines (use `t.Error` and communicate via channels)
- ❌ Sharing `*testing.T` across goroutines without synchronization

## 13. Summary

**Table-driven tests + interface-based mocks + httptest + build tag separation = reliable Go test suite.**

This convention is a mandatory standard for all Go services. All new code must comply; existing systems migrate incrementally when touching related logic.
