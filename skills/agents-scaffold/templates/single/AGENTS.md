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

## Development Workflow

Follow the `engineering-guidelines` skill for scope, autonomy, implementation, and verification. User instructions and applicable project rules take precedence over skill defaults.

- **Routine, reversible changes** with clear scope may be implemented directly. Do not create a spec, plan, approval pause, or test solely for ceremony.
- Changes to **material behavior or contracts**, architecture, data handling, or migrations require the applicable spec to be updated before implementation.
- Choose **proportionate verification** based on risk and observable outcomes. Add focused regression tests when they meaningfully protect changed behavior; use the `code-conventions` skill for test design after deciding tests are warranted.
- Request review or approval only when the user, project process, or a consequential unresolved choice requires it. Do not repeat a decision already authorized in the current task.

Read [WORKFLOW.md](./WORKFLOW.md) when the task involves specs, contracts, implementation plans, or TDD.

## Authoritative Source: Contracts vs Design Specs

Not every document carries the same authority — distinguish two kinds:

- **Contracts (normative, live)** — API specs, error codes, response envelope, retry policy, auth contracts, and convention documents under `docs/`. The agreed interface and rules, kept in sync with reality. When code deviates, **the code is the defect** — fix the code (or deliberately amend the contract first).
- **Design specs (descriptive, point-in-time)** — feature/domain docs under `docs/specs/` and plans under `docs/plans/`. Written to drive a feature at design time; as logic iterates they drift and go stale.

**Reading vs writing:**

- **Writing** material new/changed behavior or contracts → update the applicable spec before implementation. Routine, reversible changes may proceed without creating a spec.
- **Reading / verifying / "what does the system do today"** → **current code is the source of truth**. A design spec states intent when written, not necessarily current behavior.
- **Spec and code disagree** → never silently trust the spec. For a *design spec*, treat it as drift: verify against code and flag the spec for update. For a *contract*, the opposite default — the contract wins and the code is suspect.

## Progress Tracking

[ROADMAP.md](./ROADMAP.md) is the **live status** of this project — current phase, in-progress work, blockers, open questions, todo, done. It is not a spec: specs state what the system should be, the roadmap states where the work stands right now.

- **Read it when relevant**: before planning or continuing tracked work, or when current phase, blockers, and sequencing could affect the task. Routine untracked edits do not require loading it.
- **Update it when tracked project state changes**: a tracked feature shipped, a blocker changed, a spec or contract landed, or a significant investigation produced a decision. Do not add entries for routine untracked edits or read-only work.
- **Done means verified** — an item moves to Done only after it is implemented *and* verified, with the verification recorded in the entry. Implemented but unverified stays In Progress.
- **Never guess** — anything unconfirmed goes to Open Questions, not into Todo or Done as if settled.
- **Scope** — a README describes what the project is and how to use it; ROADMAP.md carries what changes.

## Implementation Plans

Create a plan under `docs/plans/` only when complexity, dependencies, sequencing, or acceptance checks need a durable artifact. Each plan links the governing spec when one exists. Detailed rules are in [WORKFLOW.md](./WORKFLOW.md).

## Domain-Driven Design (DDD)

This project follows DDD principles:

- **Aggregate Roots** must be clearly identified in both specs and code. Each bounded context has explicit aggregate roots.
- **Bounded Contexts** are delineated within this repo. Cross-context communication happens only through well-defined interfaces (as specified under `docs/`), not by reaching into another context's internals.
- **Ubiquitous Language** is defined in [CONTEXT.md](./CONTEXT.md) and used consistently across specs and code.

### Core Domain Concepts

Defined in [CONTEXT.md](./CONTEXT.md) — the project glossary (aggregate roots, value objects, domain events). It is the single place a term is defined: do not restate definitions here or under `docs/`, link to it instead.

## Conventions

### Convention Documents

Universal cross-cutting conventions (HTTP/API design, observability, testing, commit messages, error codes, language-specific rules) are **not** duplicated here — reference the `code-conventions` skill at runtime. Project-private conventions are documented under `docs/`; add an index entry here when one is added.

### Spec Document Index (Mandatory Maintenance)

**Rule**: Every governing spec (API contracts, error codes, conventions, domain contracts) MUST be referenced in this file. AGENTS.md is the context-loading entry point — an unreferenced spec is invisible to agents and risks being ignored or contradicted.

**Exception**: Feature/requirement specs under `docs/specs/` are transient and numerous — they do **not** need an index entry.

**How**: Every governing contract or convention document under `docs/` must appear either in the [Specifications & Contracts](#specifications--contracts) bullet list or the Repository Structure tree below, with its actual filename and relative link.

## Repository Structure

A static map of the repo. Contract and convention documents live directly under `docs/`; `docs/specs/` and `docs/plans/` accumulate dated documents over time.

```
{{PROJECT}}/
├── AGENTS.md          # This file - project rules, conventions, and module guide
├── CLAUDE.md          # → @AGENTS.md
├── CONTEXT.md         # Ubiquitous language (project glossary)
├── ROADMAP.md         # Live project status (phase, in progress, blocked, done)
├── WORKFLOW.md        # Detailed development workflow (load when applicable)
└── docs/
    ├── specs/         # Feature / design specifications (the "what")
    ├── plans/         # Implementation plans (the "how")
    └── ...            # API specs, error codes, convention docs (contracts live directly here)
```
