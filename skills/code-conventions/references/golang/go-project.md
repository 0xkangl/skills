# Go Project Structure Convention v1.0

> Applies to: All Go backend services | Goal: Standardize project structure to reduce cross-project cognitive overhead

## 目录

- [Directory Structure](#directory-structure)
- [internal/ vs pkg/ Guidelines](#internal-vs-pkg-guidelines)
- [Server Lifecycle](#server-lifecycle)
- [Router Registration](#router-registration)
- [Layered Architecture](#layered-architecture)
- [Middleware (internal/middleware/)](#middleware-internalmiddleware)
- [Domain Models (internal/model/)](#domain-models-internalmodel)
- [Related Conventions](#related-conventions)

## Directory Structure

```
{{PROJECT}}-server/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── config/
│   │   └── config.go
│   ├── model/  # domain types, request/response DTOs
│   │   └── *.go
│   ├── db/  # if using sqlc (generated; do not edit)
│   ├── repository/
│   │   └── *.go
│   ├── service/
│   │   └── *.go
│   ├── handler/
│   │   └── *.go
│   ├── middleware/  # HTTP middleware (auth, logging, recovery)
│   │   └── *.go
│   └── server/
│       ├── server.go
│       └── routes.go
├── pkg/
│   ├── apperror/
│   │   └── error.go
│   ├── response/
│   │   └── response.go
│   ├── database/
│   │   └── postgres.go
│   └── validator/
│       └── validator.go
├── db/
│   ├── migrations/           # SQL migrations (golang-migrate; see go-tools.md §2.3)
│   └── queries/
├── tests/
│   ├── integration/          # Integration tests (build tag: integration)
│   └── e2e/                  # End-to-end tests (build tag: e2e)
├── docs/
│   ├── specs/
│   └── plans/
├── Makefile
├── .air.toml                 # air hot-reload config (copy from go-tools.md examples/)
├── .golangci.yml             # golangci-lint config (copy from go-tools.md examples/)
├── sqlc.yaml                 # sqlc config (copy from go-tools.md examples/)
├── .env.example
├── .gitignore
├── AGENTS.md
├── CLAUDE.md
└── README.md
```

## `internal/` vs `pkg/` Guidelines

| Location | Rule | Examples |
|----------|------|----------|
| `pkg/` | Safe for import by other Go projects; API must remain stable | apperror, response, database, validator |
| `internal/` | Project-private; not importable externally | config, model, db, repository, service, handler, middleware, server |

**Decision rule:** If a package can be directly `import`-ed and used in another Go service, place it in `pkg/`. If it contains project-specific types or constants, place it in `internal/`.

## Server Lifecycle

`internal/server/server.go` defines the Server struct:

- `New(cfg, db)` — Constructor; accepts dependencies, internally calls `registerRoutes()`
- `Start(addr)` — Starts the HTTP server with graceful shutdown support
- `Shutdown(ctx)` — Gracefully closes connections on signal interruption

`cmd/server/main.go` responsibilities: load config → initialize database → construct Server → listen for signals → Start.

## Router Registration

`internal/server/routes.go` centrally manages all routes:

- Grouped by domain with section comments
- Middleware applied by layer: global → route group → individual route
- API version prefix `/v1`
- Health check routes placed outside the version prefix (`/health`)
- Metrics endpoint (`/metrics`) — see [HTTP Constitution](../http-constitution.md) §9 for `METRICS_PORT` behavior
- Request logging middleware (`internal/middleware/logger.go`) — implements [Observability Convention](../observability.md) (traceId, structured fields, entry/exit logging)
- Input validation via `pkg/validator/` — see [Go Validation Convention](go-validation.md)

## Layered Architecture

| Layer | Responsibility | May Call |
|-------|---------------|----------|
| Handler | HTTP request parsing, input validation, response serialization | Service |
| Service | Business logic orchestration, transaction management | Repository |
| Repository | SQL queries, data mapping | Database |

Cross-layer calls are prohibited: Handlers must not access Repositories directly.

## Middleware (`internal/middleware/`)

- Cross-cutting HTTP concerns: authentication, request logging, panic recovery, and other route-level wrappers.
- Registered in `internal/server/routes.go` by layer: global → route group → individual route.
- Must not contain business logic; delegate to service via handler when side effects are needed.

## Domain Models (`internal/model/`)

- Domain entities, value objects, and cross-layer DTOs shared by handler, service, and repository.
- Repository maps between `internal/db/` (sqlc-generated row types) and `internal/model/` domain types.
- Handler-only, unexported request structs may stay in the handler package; promote to `internal/model/` when reused across handlers or layers.

## Related Conventions

| Topic | Document |
|-------|----------|
| Go style, naming, idioms | [go-style.md](go-style.md) |
| Dev tools, lint config, Makefile targets | [go-tools.md](go-tools.md) |
| Testing layout and Makefile targets | [go-testing.md](go-testing.md) |
| Input validation | [go-validation.md](go-validation.md) |
| Structured logging | [observability.md](../observability.md) |
| HTTP API design | [http-constitution.md](../http-constitution.md) |
