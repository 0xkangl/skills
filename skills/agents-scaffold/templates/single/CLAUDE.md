# {{PROJECT}}

## Architecture

This is a **single-repository** project. All code, specifications, contracts, and conventions live in this one repo. Contracts (API, error codes) and project-private conventions are documented under `docs/` and govern the code in the same tree.

<!-- MODULE_STACK -->

## Specifications & Contracts

This repo documents its own **contracts** and **specs** under `docs/` (contract documents live directly under `docs/`, not in sub-directories):

- API interface specifications (endpoints, request/response schemas) → `docs/`
- Error format and error code registry → `docs/`
- Response envelope format, retry/backoff strategies, auth contracts → `docs/`
- Project-private convention documents → `docs/` (see [Convention Documents](#convention-documents))
- Feature / domain design specs → `docs/specs/`
- Implementation plans → `docs/plans/`

**Rule**: Every spec that governs behavior (API, error codes, conventions, domain contracts) MUST be discoverable from this file (see [Spec Document Index](#spec-document-index-mandatory-maintenance)). Transient feature specs under `docs/specs/` are the exception.

## Development Paradigm: SDD + TDD

Before writing or changing any code, follow the agent coding behavior rules (think-before-coding, simplicity-first, surgical-changes, goal-driven execution, root-cause reasoning) — see the `engineering-guidelines` skill.

### Specification-Driven Development (SDD)

1. Write or update the relevant spec **first** (contracts and conventions under `docs/`; feature/design specs in `docs/specs/`).
2. Get the spec reviewed and approved.
3. Implement against the spec.

### Test-Driven Development (TDD)

1. From the spec, write failing tests.
2. Write the minimum implementation to pass.
3. Refactor while keeping tests green.

For implementation-phase TDD details (AAA structure, naming, mocks, coverage, integration tests), see the `code-conventions` skill.

**All code changes must trace back to a spec document.**

## Authoritative Source: Contracts vs Design Specs

Not every document carries the same authority — distinguish two kinds:

- **Contracts (normative, live)** — API specs, error codes, response envelope, retry policy, auth contracts, and convention documents under `docs/`. The agreed interface and rules, kept in sync with reality. When code deviates, **the code is the defect** — fix the code (or deliberately amend the contract first).
- **Design specs (descriptive, point-in-time)** — feature/domain docs under `docs/specs/` and plans under `docs/plans/`. Written to drive a feature at design time; as logic iterates they drift and go stale.

**Reading vs writing:**

- **Writing** new/changed logic → start from a spec (SDD): update the design spec, then implement.
- **Reading / verifying / "what does the system do today"** → **current code is the source of truth**. A design spec states intent when written, not necessarily current behavior.
- **Spec and code disagree** → never silently trust the spec. For a *design spec*, treat it as drift: verify against code and flag the spec for update. For a *contract*, the opposite default — the contract wins and the code is suspect.

## Implementation Plans

Feature plans live under `docs/plans/`. Each plan declares its goal, scope, dependencies, steps, and acceptance criteria, and links the spec(s) it implements.

**Plan structure:**

1. **Spec first** — Write and approve the design spec in `docs/specs/` (and update the contract docs under `docs/` when the interface changes) before planning implementation.
2. **One plan per feature** — Use a `YYYY-MM-DD-feature.md` filename for discoverability.
3. **Declare dependencies** — A plan MUST link to the spec it implements and state `Depends on: <other-plan>` when sequencing matters.

**Splitting large plans into sub-plans:** When a single plan is too large to review or execute in one pass (multiple phases or independent work streams), split it so each piece is reviewable and mergeable on its own:

1. **Parent plan** — `docs/plans/YYYY-MM-DD-feature.md` with an overview, scope, and links to all sub-plans.
2. **Sub-plans** — `docs/plans/YYYY-MM-DD-feature--<slug>.md` where `<slug>` names the sub-scope (e.g. `--schema`, `--api`, `--ui-list`). Each states its own goal, scope, dependencies, steps, and acceptance criteria.
3. **Order** — The parent plan records the recommended execution order; sub-plans declare `Depends on: <sub-plan-slug>` when sequencing matters.
4. **Don't over-split** — Keep each sub-plan a meaningful, self-contained unit of work; if a split only produces trivial fragments, keep it as one plan.

**Example:**

```
docs/specs/2026-06-01-user-management.md              ← design spec
docs/plans/2026-06-01-user-management.md              ← parent overview
docs/plans/2026-06-01-user-management--schema.md      ← data layer
docs/plans/2026-06-01-user-management--api.md         ← API + handlers; Depends on schema
docs/plans/2026-06-01-user-management--ui-list.md     ← list UI; Depends on api
```

## Domain-Driven Design (DDD)

This project follows DDD principles:

- **Aggregate Roots** must be clearly identified in both specs and code. Each bounded context has explicit aggregate roots.
- **Bounded Contexts** are delineated within this repo. Cross-context communication happens only through well-defined interfaces (as specified under `docs/`), not by reaching into another context's internals.
- **Ubiquitous Language** is defined here and used consistently across specs and code.

### Core Domain Concepts

<!-- Define project core domain concepts here (aggregate roots, value objects, etc.) -->

## Conventions

### Convention Documents

Universal cross-cutting conventions (HTTP/API design, observability, testing, commit messages, error codes, language-specific rules) are **not** duplicated here — reference the `code-conventions` skill at runtime. Project-private conventions are documented under `docs/`; add an index entry here when one is added.

### Spec Document Index (Mandatory Maintenance)

**Rule**: Every governing spec (API contracts, error codes, conventions, domain contracts) MUST be referenced in this file. CLAUDE.md is the context-loading entry point — an unreferenced spec is invisible to agents and risks being ignored or contradicted.

**Exception**: Feature/requirement specs under `docs/specs/` are transient and numerous — they do **not** need an index entry.

**How**: Every governing contract or convention document under `docs/` must appear either in the [Specifications & Contracts](#specifications--contracts) bullet list or the Repository Structure tree below, with its actual filename and relative link.

## Repository Structure

A static map of the repo. Contract and convention documents live directly under `docs/`; `docs/specs/` and `docs/plans/` accumulate dated documents over time.

```
{{PROJECT}}/
├── CLAUDE.md          # This file - project rules, conventions, and module guide
├── AGENTS.md          # → @CLAUDE.md
└── docs/
    ├── specs/         # Feature / design specifications (the "what")
    ├── plans/         # Implementation plans (the "how")
    └── ...            # API specs, error codes, convention docs (contracts live directly here)
```
