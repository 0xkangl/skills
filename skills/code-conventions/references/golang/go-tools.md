# Go Dev Tools Convention v1.0

> Applies to: All Go backend services | Goal: Standardize dev tooling, lint configuration, and Makefile targets

This document defines the mandatory development tools, their configuration files, and Makefile targets for every Go service. See [go-project.md](go-project.md) for directory layout.

## 1. Required Tools

| Tool | Purpose | Install |
|------|---------|---------|
| [air](https://github.com/air-verse/air) | Hot reload during local development | `go install github.com/air-verse/air@latest` |
| [golangci-lint](https://golangci-lint.run/) | Aggregated static analysis and lint | `go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest` |
| [goimports](https://pkg.go.dev/golang.org/x/tools/cmd/goimports) | Format Go code and manage imports | `go install golang.org/x/tools/cmd/goimports@latest` |
| [govulncheck](https://pkg.go.dev/golang.org/x/vuln/cmd/govulncheck) | Scan dependencies for known CVEs | `go install golang.org/x/vuln/cmd/govulncheck@latest` |
| [migrate](https://github.com/golang-migrate/migrate) | SQL schema migrations (PostgreSQL) | `go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest` |
| [sqlc](https://sqlc.dev/) | Type-safe Go code generation from SQL | `go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest` |

**Rule**: All six tools MUST be installable via `make tools` and verifiable via `make tools-check`. Pin versions in the Makefile or a `tools/tools.go` file when reproducibility matters.

## 2. Configuration Files

Every Go service MUST keep these files at the repository root:

```
{{PROJECT}}-server/
├── .air.toml          # air hot-reload config (see §2.1)
├── .golangci.yml      # golangci-lint config (see §2.2)
├── sqlc.yaml          # sqlc code generation config (see §2.4)
└── Makefile
```

**Reference configs** (normative examples, not convention documents) live in `{{PROJECT}}-spec-center/conventions/golang/examples/`. When a service adopts the Go stack, copy them to the service repository root and adjust paths (e.g. `cmd` entrypoint) as needed. The generic `server` scaffold does not include these files — they apply only to Go backends.

### 2.1 `.air.toml`

Reference: [`examples/.air.toml`](examples/.air.toml)

| Section | Key settings | Purpose |
|---------|--------------|---------|
| `[build]` | `cmd`, `bin` | Build command and output binary path under `tmp/` |
| `[build]` | `include_ext` | File extensions that trigger rebuild (`go`, `tpl`, …) |
| `[build]` | `exclude_dir` | Directories to ignore (`tmp`, `vendor`, `bin`, `tests`) |
| `[build]` | `send_interrupt`, `kill_delay` | Graceful shutdown on reload (pairs with server `Shutdown`) |
| `[misc]` | `clean_on_exit` | Remove `tmp/` artifacts when air exits |

Default build command:

```toml
cmd = "go build -o ./tmp/main ./cmd/server"
bin = "tmp/main"
```

Adjust `cmd` / `bin` if the entry point is not `cmd/server/main.go`.

### 2.2 `.golangci.yml`

Reference: [`examples/.golangci.yml`](examples/.golangci.yml)

Uses **golangci-lint v2** config format (`version: "2"`).

#### `run`

| Key | Value | Purpose |
|-----|-------|---------|
| `timeout` | `5m` | Per-linter run timeout; increase only for very large codebases |

#### `linters`

| Setting | Value | Purpose |
|---------|-------|---------|
| `default` | `none` | Explicit opt-in; no implicit linter set |
| `enable` | see config file | Enabled linters (see table below) |

**Enabled linters:**

| Linter | Category | Purpose |
|--------|----------|---------|
| `errcheck` | correctness | Unchecked errors |
| `govet` | correctness | Suspicious constructs (vet) |
| `staticcheck` | correctness | Advanced static analysis |
| `unused` | correctness | Unused code |
| `ineffassign` | correctness | Ineffectual assignments |
| `bodyclose` | HTTP | Unclosed response bodies |
| `nilnil` | correctness | `return nil, nil` anti-pattern |
| `gocritic` | style | Opinionated diagnostics and style |
| `gosec` | security | Security issues |
| `misspell` | style | Typos in comments/strings (US locale) |
| `goconst` | style | Repeated strings → constants |
| `gocyclo` | complexity | Cyclomatic complexity (threshold: 15) |
| `unconvert` | style | Redundant type conversions |
| `errorlint` | correctness | Error wrapping / `%w` usage |
| `revive` | style | Golint replacement (exported docs, unused params) |

**Linter settings highlights:**

- `gocyclo.min-complexity: 15` — functions above this complexity fail lint.
- `gocritic` — `diagnostic` and `style` tags enabled; `ifElseChain` disabled.
- `revive` — enforces exported symbol documentation, flags unused parameters/receivers, and `indent-error-flow`.
- `misspell.locale: US` — US English spelling.

#### `linters.exclusions`

| Rule | Purpose |
|------|---------|
| `(.+)_test\.go` → disable `errcheck`, `gosec`, `goconst`, `gocritic` | Relax strict checks in tests |
| `paths: internal/db/` | Skip sqlc-generated code |

Add paths for other generated packages if sqlc output lives elsewhere.

#### `issues`

| Key | Value | Purpose |
|-----|-------|---------|
| `max-issues-per-linter` | `50` | Cap report size per linter |
| `max-same-issues` | `5` | Cap duplicate issue noise |

#### `formatters`

| Formatter | Purpose |
|-----------|---------|
| `goimports` | Import grouping and formatting (used by `golangci-lint fmt` and as a standalone tool via `make fmt`) |

**Rule**: Do not disable linters project-wide without a documented reason in the service's `docs/specs/`. Prefer `exclusions.paths` for generated code.

### 2.3 SQL Migrations (`db/migrations/`)

Uses [golang-migrate](https://github.com/golang-migrate/migrate) CLI. Migration files live in `db/migrations/` (see [go-project.md](go-project.md)).

#### File naming

Each migration is a **pair** of SQL files:

```
db/migrations/
├── 000001_create_users_table.up.sql
├── 000001_create_users_table.down.sql
├── 000002_add_email_index.up.sql
└── 000002_add_email_index.down.sql
```

| Pattern | Example | Purpose |
|---------|---------|---------|
| `{version}_{name}.up.sql` | `000001_create_users_table.up.sql` | Forward migration |
| `{version}_{name}.down.sql` | `000001_create_users_table.down.sql` | Rollback for the same version |

- `{version}` — zero-padded sequential integer (`000001`, `000002`, …). Generate via `migrate create -seq`.
- `{name}` — snake_case description of the change.

Create a new migration:

```bash
make migrate-create NAME=add_email_index
# equivalent: migrate create -ext sql -dir db/migrations -seq add_email_index
```

#### Rules

- Every `.up.sql` MUST have a matching `.down.sql` that reverses the change.
- Never edit a migration that has already been applied in any shared environment; add a new migration instead.
- Keep migrations idempotent where practical (e.g. `IF NOT EXISTS` for additive DDL).
- `DATABASE_URL` MUST use the PostgreSQL scheme expected by golang-migrate, e.g. `postgres://user:pass@localhost:5432/dbname?sslmode=disable`.

### 2.4 SQL Code Generation (`sqlc`)

Uses [sqlc](https://sqlc.dev/) to generate type-safe database access code from SQL. Query files live in `db/queries/`; generated Go code goes to `internal/db/` (see [go-project.md](go-project.md)). Schema is derived from `db/migrations/` — run migrations (or add migration files) before generating.

Reference: [`examples/sqlc.yaml`](examples/sqlc.yaml)

#### Layout

```
db/
├── migrations/          # schema source for sqlc (see §2.3)
└── queries/             # hand-written SQL; one file per domain/table
    ├── users.sql
    └── posts.sql
internal/
└── db/                  # generated by sqlc — do not edit
    ├── db.go
    ├── models.go
    └── *.sql.go
```

#### Query file conventions

- One `.sql` file per aggregate or table group (e.g. `users.sql`, `orders.sql`).
- Name queries with `-- name: <PascalCase> :one|:many|:exec|:copyfrom` annotations.
- Use `$1`, `$2`, … for parameters; sqlc maps them to typed Go arguments.
- Keep queries in `db/queries/` only; never put ad-hoc SQL in `internal/repository/` when sqlc is in use.

Example (`db/queries/users.sql`):

```sql
-- name: GetUserByID :one
SELECT id, email, created_at
FROM users
WHERE id = $1;

-- name: ListUsers :many
SELECT id, email, created_at
FROM users
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;
```

#### Rules

- **Never edit** files under `internal/db/`; regenerate with `make sqlc-gen`.
- After a schema change: `make migrate-create` → edit migration pair → `make migrate-up` → update or add queries → `make sqlc-gen`.
- Repository layer maps sqlc row types to `internal/model/` domain types; handlers and services MUST NOT import `internal/db/` directly except through repositories.
- Commit generated code (`internal/db/`) so CI and reviewers see query/type changes without running sqlc.
- Regenerate in CI only if you prefer not to commit generated code; this project **commits** generated output — do not add a CI-only generate step unless the team explicitly opts out.

#### `sqlc.yaml` highlights

| Key | Value | Purpose |
|-----|-------|---------|
| `queries` | `db/queries` | Directory of annotated SQL query files |
| `schema` | `db/migrations` | Migration SQL used as schema definition |
| `gen.go.package` | `db` | Go package name for generated code |
| `gen.go.out` | `internal/db` | Output directory (excluded from lint; see §2.2) |
| `gen.go.sql_package` | `pgx/v5` | Database driver package for generated interfaces |
| `emit_json_tags` | `true` | camelCase JSON tags on row structs — aligns with [HTTP Constitution](../http-constitution.md) §3.2 when mapping to `internal/model/` |
| `json_tags_case_style` | `camel` | Transform DB snake_case columns (`created_at`) to API-style tags (`createdAt`); required when `emit_json_tags` is true |
| `emit_prepared_queries` | `false` | Use pgx extended protocol without per-query `Prepare()` cache; avoids PgBouncer transaction-pooling issues |
| `emit_interface` | `true` | Generate `Querier` interface for repository injection and interface-based mocks ([go-testing.md](go-testing.md)) |
| `emit_exact_table_names` | `false` | Singular struct names (`User` from `users` table) — standard Go domain naming |
| `emit_empty_slices` | `true` | `:many` queries return `[]T{}` instead of `nil` — matches empty `list` arrays in API responses |
| `emit_pointers_for_null_types` | `true` | Nullable columns as `*string` / `*int64` instead of `sql.NullString` — cleaner repository → model mapping |

## 3. Makefile Targets

Every Go service Makefile MUST implement the targets below. Variable names may differ; behavior MUST match.

### 3.1 Development

```makefile
.PHONY: dev
dev: ## Start dev server with hot reload (air)
	air
```

Requires `.air.toml` at the repository root. Pass environment variables via `.env` (air inherits the shell environment).

### 3.2 Formatting

```makefile
.PHONY: fmt
fmt: ## Format code (goimports)
	goimports -w .
```

`goimports` applies `gofmt` and adds/removes/reorders imports. Run before commit; `make check` invokes `fmt` first.

To format via golangci-lint instead (uses the `formatters` section of `.golangci.yml`):

```bash
golangci-lint fmt ./...
```

Prefer `make fmt` (`goimports -w .`) for speed in local workflows.

### 3.3 Lint

```makefile
.PHONY: lint
lint: ## Run linter (golangci-lint)
	golangci-lint run ./...
```

Reads `.golangci.yml` from the repository root. CI MUST run `make lint` (or equivalent) on every PR.

Fix auto-fixable issues:

```bash
golangci-lint run --fix ./...
```

### 3.4 Vulnerability Scan

```makefile
.PHONY: govulncheck
govulncheck: ## Scan for known vulnerabilities in dependencies
	govulncheck ./...
```

Scans module dependencies and the standard library for known CVEs. Run in CI and before release (`make release-check`).

### 3.5 Aggregate Checks

```makefile
.PHONY: check release-check
check: fmt lint govulncheck test ## Run all quality checks (fmt + lint + govulncheck + test)
release-check: lint govulncheck test ## Pre-release checks (lint + govulncheck + test)
```

| Target | When to use |
|--------|-------------|
| `check` | Local pre-commit; full quality gate including format and unit tests |
| `release-check` | Before `docker` / `deploy`; skips `fmt` (CI should already enforce formatting) |

See [go-testing.md](go-testing.md) §10 for `test`, `test-integration`, and `test-e2e` targets.

### 3.6 Database Migrations

Requires `DATABASE_URL` (read from `.env` or the environment). Migration path defaults to `db/migrations/`.

```makefile
MIGRATIONS_DIR := db/migrations

.PHONY: migrate-up migrate-down migrate-create migrate-version
migrate-up: ## Apply all pending migrations
	@test -n "$(DATABASE_URL)" || (echo "DATABASE_URL is not set. Check your .env file." && exit 1)
	migrate -path $(MIGRATIONS_DIR) -database "$(DATABASE_URL)" up

migrate-down: ## Roll back the last migration step
	@test -n "$(DATABASE_URL)" || (echo "DATABASE_URL is not set." && exit 1)
	migrate -path $(MIGRATIONS_DIR) -database "$(DATABASE_URL)" down 1

migrate-create: ## Create a new migration pair (usage: make migrate-create NAME=add_users)
	@test -n "$(NAME)" || (echo "NAME is required. Example: make migrate-create NAME=add_users" && exit 1)
	migrate create -ext sql -dir $(MIGRATIONS_DIR) -seq $(NAME)

migrate-version: ## Show current migration version
	@test -n "$(DATABASE_URL)" || (echo "DATABASE_URL is not set." && exit 1)
	migrate -path $(MIGRATIONS_DIR) -database "$(DATABASE_URL)" version
```

| Target | When to use |
|--------|-------------|
| `migrate-up` | After pulling new migrations; before integration tests; in deploy pipelines |
| `migrate-down` | Local rollback of the last step; never on production without a runbook |
| `migrate-create` | Starting a schema change; edit the generated `.up.sql` / `.down.sql` pair |
| `migrate-version` | Debugging migration state or CI verification |

Local workflow: `make db-up` → `make migrate-up` → `make dev`. See `db-up` / `db-down` in the service Makefile (Docker Compose).

### 3.7 SQL Code Generation

Requires `sqlc.yaml` at the repository root. Run after schema or query changes.

```makefile
.PHONY: sqlc-gen
sqlc-gen: ## Generate type-safe Go from SQL (sqlc)
	sqlc generate
```

| Target | When to use |
|--------|-------------|
| `sqlc-gen` | After editing `db/queries/` or applying new migrations; before commit when SQL changed |

Typical workflow: `make migrate-create NAME=add_users` → edit `.up.sql` / `.down.sql` → `make migrate-up` → add queries in `db/queries/` → `make sqlc-gen` → implement repository using generated `Queries` type.

### 3.8 Toolchain

```makefile
.PHONY: tools tools-check
tools: ## Install / update all dev tools
	go install github.com/air-verse/air@latest
	go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest
	go install golang.org/x/tools/cmd/goimports@latest
	go install golang.org/x/vuln/cmd/govulncheck@latest
	go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
	go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest

tools-check: ## Verify all required tools are installed
	@which air            > /dev/null 2>&1 && echo "  ✓ air"            || echo "  ✗ air            (make tools)"
	@which golangci-lint  > /dev/null 2>&1 && echo "  ✓ golangci-lint"  || echo "  ✗ golangci-lint  (make tools)"
	@which goimports      > /dev/null 2>&1 && echo "  ✓ goimports"      || echo "  ✗ goimports      (make tools)"
	@which govulncheck    > /dev/null 2>&1 && echo "  ✓ govulncheck"    || echo "  ✗ govulncheck    (make tools)"
	@which migrate        > /dev/null 2>&1 && echo "  ✓ migrate"        || echo "  ✗ migrate        (make tools)"
	@which sqlc           > /dev/null 2>&1 && echo "  ✓ sqlc"           || echo "  ✗ sqlc           (make tools)"
```

## 4. CI Integration

PR pipeline (extends [testing.md](../testing.md) §11.2):

```
lint → govulncheck → test → test-integration → coverage report
```

Main branch adds `test-e2e` after integration tests. `make lint` and `make govulncheck` MUST NOT be skipped or silenced (`|| true`).

## 5. Related Conventions

| Topic | Document |
|-------|----------|
| Project layout | [go-project.md](go-project.md) |
| Style and idioms | [go-style.md](go-style.md) |
| Test Makefile targets | [go-testing.md](go-testing.md) |
| Universal Makefile targets | [testing.md](../testing.md) §11.1 |
