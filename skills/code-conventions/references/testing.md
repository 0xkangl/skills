# Testing Convention v1.0

> Applies to: All modules (server, web, client) | Goal: Standardize testing strategy, structure, naming, and quality expectations so every module delivers reliable, maintainable, and well-verified code

For the full convention index, see [../SKILL.md](../SKILL.md).

## 0. TDD Workflow

The implementation phase of spec-first development (SDD — see each project's `spec-center/AGENTS.md`) is driven by tests:

1. From the spec, write failing tests.
2. Write the minimum implementation to pass.
3. Refactor while keeping tests green.

## 1. Design Principles

- **Spec-traceable**: Every test must trace back to a spec document (spec-first/SDD — see each project's `spec-center/AGENTS.md`). No orphan tests.
- **Deterministic**: Tests must produce the same result on every run. No reliance on time of day, random values, or external service state.
- **Isolated**: Each test is independent. No shared mutable state between tests. No test ordering dependencies.
- **Fast feedback**: Unit tests run in seconds. Integration tests may be slower but must be clearly separated and opt-in.
- **Meaningful assertions**: Assert behavior and outcomes, not implementation details. Every assertion must verify a requirement from a spec.

## 2. Test Categories

| Category | Scope | Speed | When to Run |
|----------|-------|-------|-------------|
| Unit | Single function / method / class; all dependencies mocked or stubbed | < 1s total | Every commit (`make test`) |
| Integration | Multiple components; real database / HTTP server / file I/O | Seconds | Pre-merge (`make test-integration`), CI |
| End-to-End | Full user flow across module boundaries | Minutes | Nightly / pre-release, CI on `main` |

**Rule**: `make test` runs only unit tests. Integration and E2E tests are separate Makefile targets.

## 3. Test File Organization

- Test files live alongside the code they test, following the language / framework convention.
- Test helpers shared across files go in a dedicated test utility module (e.g., `testUtils.ts`, `testutil.py`, `TestHelper.java`) within the same package or a `tests/` directory.
- Integration and E2E tests are placed in a separate directory (e.g., `tests/integration/`, `tests/e2e/`), not mixed with unit tests.
- Never create test files without a corresponding source file (or a clear cross-module integration scope).

### Language-Specific Conventions

Language-specific file organization, naming, and patterns are defined in dedicated convention documents:

- Go: [go-testing.md](golang/go-testing.md) — Makefile targets, build tags, httptest patterns
- Go: [go-style.md](golang/go-style.md) — naming, errors, interfaces, concurrency idioms
- Go: [go-tools.md](golang/go-tools.md) — lint, format, vulnerability scan, hot reload, SQL migrations

Web and client modules: follow the framework's convention (co-located test files or a mirrored directory), stay consistent within the module, and still comply with §2–§12 of this document.

## 4. Naming Conventions

### 4.1 Test Function Names

Use descriptive names that state the **scenario and expected outcome**:

```
test_<function>_<scenario>_<expectedResult>
```

Or use the framework's descriptive string style:

```
describe("function", () => {
  it("returns conflict when email is duplicate", ...);
  it("returns created when input is valid", ...);
});
```

### 4.2 Test File Names

Follow the language / framework convention. Pick one pattern per module and stay consistent.

| Language | Convention | Example |
|----------|-----------|---------|
| Go | `<source>_test.go` | `user_test.go` |
| TypeScript / JavaScript | `<source>.test.<ext>` or `<source>.spec.<ext>` | `user.test.ts` |
| Python | `test_<source>.py` | `test_user.py` |

## 5. Test Structure (Arrange-Act-Assert)

Every test must follow the **AAA** pattern:

1. **Arrange** — Set up inputs, mocks, and preconditions.
2. **Act** — Execute the function / method under test.
3. **Assert** — Verify outcomes and side effects.

Separate each section with blank lines. No logic in `Assert` beyond assertions.

## 6. Mocking and Test Doubles

### 6.1 When to Mock

| Dependency | Mock or Real |
|------------|-------------|
| Database (unit tests) | Mock |
| Database (integration tests) | Real (test container / Docker) |
| External HTTP services | Mock (use interface + mock implementation) |
| Internal service layer | Mock downstream dependencies |
| Time | Mock (inject clock function or use fixed time) |
| File system | Use temp directories for real FS tests, or mock FS interface |

### 6.2 General Mocking Rules

- Define interfaces / protocols for all external dependencies. Accept interfaces, return concrete types.
- Mock dependencies, never the module under test.
- Use hand-written mocks for simple cases. Use generated mocks for complex interfaces.
- Prefer mocking at the boundary (HTTP layer, service interface) rather than at the internal function level.

## 7. Error Testing

When testing error paths:

- Assert the **error type** or **error code**, not the error message string (messages may change).
- Distinguish "must fail" (hard assertion) from "may fail" (soft assertion) based on test intent.
- Always verify that the error code returned to the client matches [error-codes.md](./error-codes.md).

## 8. Test Data

### 8.1 Factories over Fixtures

- Use factory functions to create test data, not static fixture files.
- Factories allow customization per test case via optional overrides or builder patterns.
- Default factory values must be valid and self-consistent.

### 8.2 Rules

- Never use production data in tests.
- Never hard-code magic values — use named constants or factory defaults.
- Test data must be self-contained within the test or test helper.

## 9. Coverage

### 9.1 Minimum Coverage

| Layer | Minimum Coverage |
|-------|-----------------|
| Business logic (service / use-case) | 80% |
| HTTP / API handlers | 70% |
| Data access (repository) | 60% (unit) / covered by integration |
| Middleware / interceptors | 80% |

These are **floors, not ceilings**. Critical business logic (payments, auth, data integrity) should target 90%+.

### 9.2 Coverage Rules

- Coverage is measured per-module and reported in CI.
- PRs that decrease coverage on modified files are flagged for review.
- Coverage without meaningful assertions is worse than no coverage — don't game the numbers.

## 10. Integration Tests

### 10.1 Scope

Integration tests verify that multiple layers work together correctly:

- Full stack (handler → service → repository → database)
- Middleware chain
- API endpoint with real HTTP server

### 10.2 Database Handling

- Use test containers (Docker) or an ephemeral database for integration tests.
- Each test suite runs in a transaction that is rolled back after the test — no test persists data.
- Alternatively, truncate all tables before each test suite (not between every test — too slow).

### 10.3 Environment

- Integration tests MUST NOT require manual setup (e.g., manually starting a database).
- Provide a `docker-compose.test.yml` or use test containers that auto-provision dependencies.
- CI pipelines run integration tests; local runs are opt-in.

### 10.4 Separation

- Integration tests must be clearly separated from unit tests (separate directory, build tag, or test runner configuration).
- The default `make test` target MUST NOT run integration tests.

## 11. Test Execution

### 11.1 Makefile Targets

Every module's Makefile MUST provide:

```makefile
test:              # Run unit tests only
test-cover:        # Run unit tests with coverage report
test-integration:  # Run integration tests (requires Docker / DB)
test-e2e:          # Run end-to-end tests
check:             # fmt + lint + test (pre-commit)
```

### 11.2 CI Pipeline

```
PR pipeline:
  lint → test → test-integration → coverage report

Main branch pipeline:
  lint → test → test-integration → test-e2e → coverage report
```

Integration and E2E tests MUST NOT be part of the default `test` target.

## 12. Prohibited Patterns

- ❌ Tests that depend on execution order or shared mutable state
- ❌ Using `sleep` / `time.Sleep` to wait for async results (use channels, callbacks, futures, or polling with timeout)
- ❌ Mocking the module under test (mock dependencies only)
- ❌ Ignoring test failures in CI (`|| true` on test commands)
- ❌ Committing generated coverage reports or test artifacts
- ❌ Asserting on error message strings instead of error codes / error types
- ❌ Using production database connections in tests
- ❌ Skipping failing tests without a linked issue / TODO comment
- ❌ Writing tests that only verify mock interactions without asserting business outcomes
- ❌ Testing private/internal functions by breaking encapsulation (test through public API)

## 13. Pre-Review Checklist

Before submitting code for review:

- [ ] All new functions / methods have corresponding tests
- [ ] Tests follow AAA pattern with clear separation
- [ ] Test names describe scenario and expected outcome
- [ ] Both success and error paths are tested
- [ ] No `sleep` for synchronization
- [ ] Integration tests are separated from unit tests
- [ ] Coverage meets minimum thresholds on changed files
- [ ] Test data uses factories, not hard-coded magic values

## 14. Summary

**Spec-traceable tests + deterministic execution + clear naming + isolated state = trustworthy test suite.**

This convention is an organization-wide mandatory standard. All new code must comply; existing systems migrate incrementally when touching related logic.
