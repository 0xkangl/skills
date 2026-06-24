# Spec Center (SSOT)

## Architecture

This project follows a **multi-repo workspace** architecture. Each module is an independent repository; all repositories coexist in a workspace directory for local development, sharing specs, contracts, and conventions through `spec-center`.

### Module Map

| Module | Role |
|---|---|
<!-- MODULE:client -->| `{{PROJECT}}-client` | Client application |
<!-- MODULE:server -->| `{{PROJECT}}-server` | Server application |
| `{{PROJECT}}-spec-center` | **Single Source of Truth (SSOT)** for cross-module contracts and constraints |
<!-- MODULE:web -->| `{{PROJECT}}-web` | Web application|

> **Adding a New Module**: When a new module directory is created, the following steps MUST be performed:
> 1. Add the new module entry to the **Module Map** table above (sorted alphabetically).
> 2. Add the module directory to the **Repository Structure** tree below, following the existing pattern (`AGENTS.md` + `docs/`).
> 3. Ensure the new module has its own `AGENTS.md` with Role, Mandatory Specs (relative links to {{PROJECT}}-spec-center), Key Responsibilities, Tech Stack, and Build & Test sections.

## Spec Center as SSOT

`{{PROJECT}}-spec-center` holds all **shared** specifications that govern inter-module collaboration:

- API interface specifications (endpoints, request/response schemas) → `api/openapi.yaml`
- Error format and error code registry → `errors/error-codes.md`
- Response envelope format
- Retry and backoff strategies
- Authentication and authorization contracts
- Shared domain vocabulary and event schemas
- Cross-module domain specs → `docs/specs/`
- Data format conventions (date, pagination, sorting, etc.)
- Convention documents → `conventions/` — see [Convention Documents](#convention-documents)

**Rule**: Any spec that affects two or more modules MUST live in `{{PROJECT}}-spec-center`. Any spec that only affects a single module MUST live in that module's own `docs/` directory.

## Development Paradigm: SDD + TDD

### Specification-Driven Development (SDD)

1. Write or update the relevant spec **first** (in `{{PROJECT}}-spec-center` for shared specs, or in the module's `docs/` for local specs).
2. Get spec reviewed and approved.
3. Implement against the spec.

### Test-Driven Development (TDD)

1. From the spec, write failing tests.
2. Write the minimum implementation to pass.
3. Refactor while keeping tests green.

**All code changes must trace back to a spec document.**

## Shared vs Module-Specific Specs

When working on a feature:

1. **Identify scope** - Does this touch shared contracts or only internal logic?
2. **Shared spec** -> Write/update in `{{PROJECT}}-spec-center/`.
3. **Module-specific spec** -> Write/update in the module's `docs/` directory.
4. **Cross-reference** - Module-specific specs must reference the shared specs they depend on. Use relative links like `[API Spec](../{{PROJECT}}-spec-center/conventions/xxx.md)`.
5. **docs/ sub-directories** - Each module's `docs/` MUST contain two sub-directories:
   - `docs/specs/` — Specification documents (data models, business rules, interface definitions, constraints — the "what")
   - `docs/plans/` — Implementation plans (technical designs, architecture decisions, migration strategies, development roadmaps — the "how")

### Implementation Plans (Cross-Module Features)

Cross-module **specs** live in `{{PROJECT}}-spec-center/docs/specs/`; cross-module **plans** do **not**. Each implementing module gets its own plan under `<module>/docs/plans/`.

**Rule**: One plan per implementing module. Do **not** combine server + web (or other modules) into a single monolithic implementation plan.

| Document | Where | Example |
|---|---|---|
| Cross-module domain spec (what) | `{{PROJECT}}-spec-center/docs/specs/` | `2026-06-01-feature-design.md` |
| Server implementation plan (how) | `{{PROJECT}}-server/docs/plans/` | `2026-06-01-feature.md` |
| Web implementation plan (how) | `{{PROJECT}}-web/docs/plans/` | `2026-06-01-feature.md` |
| API / error-code contract updates | `{{PROJECT}}-spec-center/` (OpenAPI, error-codes) | Updated in spec or alongside server plan — **no** separate spec-center plan unless spec-center-only work |

**Plan structure:**

1. **Shared spec first** — Write and approve the cross-module spec in `{{PROJECT}}-spec-center` (API schemas, acceptance criteria, error codes).
2. **Split plans by module** — Create one plan per module that implements the feature. Use the same date + feature slug (e.g. `2026-06-01-feature.md`) for discoverability.
3. **Declare dependencies** — Each plan MUST link to the SSOT spec and, when applicable, state `Depends on: <other-module-plan>` (e.g. web plan depends on server plan).
4. **Execute in dependency order** — Typically `{{PROJECT}}-server` → `{{PROJECT}}-web` → `{{PROJECT}}-client`. A downstream plan MUST NOT assume upstream API changes exist until the upstream plan is merged or verified.
5. **No canonical plans in agent temp paths** — Module plans belong in `<module>/docs/plans/`, not in `docs/superpowers/plans/` or other agent-only directories. Agent-generated drafts may start elsewhere but MUST be moved to the module path before execution.

**When a single cross-module plan is acceptable (rare):** Only for small, atomic changes that must land in one PR and touch ≤2 modules with no meaningful dependency boundary (e.g. a one-field DTO addition + one UI column). Prefer split plans when in doubt.

**Splitting large plans into sub-plans:** When a single module's plan becomes large (e.g. 8+ steps, multiple phases, or spanning several independent work streams), split it into focused sub-plans to keep each one reviewable and executable in isolation:

1. **Create a parent plan** — `docs/plans/YYYY-MM-DD-feature.md` containing an overview, scope, and links to all sub-plans.
2. **Create sub-plans** — `docs/plans/YYYY-MM-DD-feature--<slug>.md` where `<slug>` describes the sub-scope (e.g. `--schema`, `--api`, `--ui-list`, `--ui-detail`).
3. **Each sub-plan MUST** — state its own goal, scope, dependencies (on other sub-plans or external modules), steps, and acceptance criteria.
4. **Order of execution** — The parent plan defines the recommended execution order; sub-plans declare `Depends on: <sub-plan-slug>` when sequencing matters.
5. **Sub-plans are independently reviewable** — Each sub-plan should be small enough to review, implement, and merge as a self-contained unit.
6. **Don't over-split** — Each sub-plan MUST contain at least 1,200 lines of implementation scope. If a split would produce sub-plans smaller than this threshold, keep the work in a single plan instead.
7. **Cap the number of sub-plans** — No more than 5 sub-plans per parent plan. If the scope requires more than 5, re-evaluate the boundaries and consolidate related sub-scopes.

**Example:**

```
{{PROJECT}}-web/docs/plans/2026-06-01-user-management.md            ← parent overview
{{PROJECT}}-web/docs/plans/2026-06-01-user-management--schema.md     ← data layer
{{PROJECT}}-web/docs/plans/2026-06-01-user-management--api-client.md ← API integration
{{PROJECT}}-web/docs/plans/2026-06-01-user-management--user-list.md  ← list page UI
{{PROJECT}}-web/docs/plans/2026-06-01-user-management--user-detail.md ← detail page UI; Depends on user-list
```

**Example (single module, no split needed):**

```
{{PROJECT}}-spec-center/docs/specs/2026-06-01-feature-design.md   ← SSOT spec
{{PROJECT}}-server/docs/plans/2026-06-01-feature.md               ← schema, API, tests
{{PROJECT}}-web/docs/plans/2026-06-01-feature.md                  ← UI; Depends on server plan
```

### Spec Ownership Quick Reference

| What | Where |
|---|---|
| API endpoint definition | `{{PROJECT}}-spec-center/` |
| Cross-module domain spec | `{{PROJECT}}-spec-center/docs/specs/` |
| Cross-module implementation plan | **Split** — one plan per module in `<module>/docs/plans/` (see [Implementation Plans](#implementation-plans-cross-module-features)) |
| Error code and format | `{{PROJECT}}-spec-center/` |
| Response envelope | `{{PROJECT}}-spec-center/` |
| Convention documents (universal + language-specific) | `{{PROJECT}}-spec-center/conventions/` — see [conventions/overview.md](conventions/overview.md) |
| Retry / circuit-breaker policy | `{{PROJECT}}-spec-center/` |
| Internal data model (not exposed via API) | Module's `docs/` |
| Internal algorithm or business logic | Module's `docs/` |
| Module implementation plan | Module's `docs/plans/` |
| Module deployment / ops config | Module's `docs/` |

## Domain-Driven Design (DDD)

All modules follow DDD principles:

- **Aggregate Roots** must be clearly identified in both specs and code. Each bounded context has explicit aggregate roots.
- **Bounded Contexts** map to modules. Cross-context communication happens only through well-defined interfaces (as specified in `{{PROJECT}}-spec-center`).
- **Ubiquitous Language** is defined in `{{PROJECT}}-spec-center` and must be used consistently across all modules.

### Core Domain Concepts

<!-- Define project core domain concepts here (aggregate roots, value objects, etc.) -->

## Module Isolation

- Each module **MUST NOT** directly access another module's database, cache, or internal storage.
- Modules communicate **only** through documented APIs or message events defined in `{{PROJECT}}-spec-center`.
- No shared database. No cross-module queries. No direct RPC to internal modules.

## Conventions

### Convention Documents

All convention documents live in `conventions/`. For the full index of universal and language-specific conventions, see **[conventions/overview.md](conventions/overview.md)**.

### AGENTS.md Hierarchy

- `{{PROJECT}}-spec-center/AGENTS.md` (this file) - Global project rules and conventions.
- `<module>/AGENTS.md` - Module-specific conventions, tech stack, build/test commands, and local development notes.

When working in a module, **load both** this file and the module's own `AGENTS.md`.

### Spec Document Index (Mandatory Maintenance)

When a spec document is **added or updated**, the corresponding AGENTS.md **MUST** be updated with a reference entry. This ensures LLMs and developers can discover and understand all active specs without scanning the filesystem.

**Rule**: No spec document should exist without being referenced in an AGENTS.md.

**Exception**: Requirement/feature spec documents under `docs/specs/` (in any module or in spec-center) do **not** need to be referenced in AGENTS.md. These specs are transient and numerous; the AGENTS.md index requirement applies to governing specs (API contracts, error codes, conventions, event schemas) only.

**How**:

1. **`{{PROJECT}}-spec-center/AGENTS.md`** — Maintain the "Spec Center as SSOT" bullet list and Repository Structure tree with actual filenames and relative links. Every file under `{{PROJECT}}-spec-center/` must appear in at least one of these two places.
2. **`<module>/AGENTS.md`** — Maintain a "Mandatory Specs" section listing all spec-center documents the module depends on, with relative links.

**Why**: AGENTS.md is the entry point for context-loading. If a spec is not referenced here, it is effectively invisible to agents and risks being ignored or contradicted.

## Repository Structure

```
workspace/
├── AGENTS.md                     # Root reference → {{PROJECT}}-spec-center/AGENTS.md
├── {{PROJECT}}-spec-center/      # SSOT - shared specs and contracts
│   ├── AGENTS.md                 # This file - global project rules
│   ├── conventions/              # Shared conventions
│   │   ├── overview.md           # Convention document index
│   │   ├── conventional-commits.md  # Git commit message convention
│   │   ├── engineering-guidelines.md  # LLM/agent coding behavior guidelines
│   │   ├── testing.md              # Testing convention (v1.0)
│   │   ├── http-constitution.md  # HTTP/API design standard (v1.0)
│   │   ├── observability.md      # Observability convention (v1.0)
│   │   └── golang/               # Go conventions; examples/ = reference configs
│   ├── api/                      # API specifications (OpenAPI / endpoint specs)
│   ├── docs/                     # Cross-module domain specifications
│   │   └── specs/                # Shared specs affecting 2+ modules
│   ├── errors/                   # Error codes and formats
│   │   └── error-codes.md        # Business error code registry
│   └── events/                   # Inter-module event definitions
<!-- BEGIN MODULE:server -->├── {{PROJECT}}-server/           # Server application
│   ├── AGENTS.md                 # Server-specific conventions
│   └── docs/
│       ├── specs/                # Server-specific specifications
│       └── plans/                # Server-specific implementation plans
<!-- END MODULE:server -->
<!-- BEGIN MODULE:web -->├── {{PROJECT}}-web/              # Web application
│   ├── AGENTS.md                 # Web-specific conventions
│   └── docs/
│       ├── specs/                # Web-specific specifications
│       └── plans/                # Web-specific implementation plans
<!-- END MODULE:web -->
<!-- BEGIN MODULE:client -->└── {{PROJECT}}-client/           # Client application
    ├── AGENTS.md                 # Client-specific conventions
    └── docs/
        ├── specs/                # Client-specific specifications
        └── plans/                # Client-specific implementation plans
<!-- END MODULE:client -->
```
