---
name: spec-driven-development
description: Use before starting any feature, bugfix, or change - enforces the spec-first workflow (write/approve spec before implementing), shared vs module-specific spec placement, cross-module plan splitting, spec ownership routing, and mandatory spec index maintenance. Every code change must trace back to a spec.
---

# Spec-Driven Development (SDD)

> Spec-layer workflow: every change starts from an approved spec. The implementation phase that follows uses TDD — see [TDD Workflow](../project-conventions/references/testing.md).

## 1. Specification-Driven Development (SDD)

1. Write or update the relevant spec **first** (in `spec-center` for shared specs, or in the module's `docs/` for local specs).
2. Get the spec reviewed and approved.
3. Implement against the spec — drive the implementation with [TDD](../project-conventions/references/testing.md).

**All code changes must trace back to a spec document.**

## 2. Shared vs Module-Specific Specs

When working on a feature:

1. **Identify scope** - Does this touch shared contracts or only internal logic?
2. **Shared spec** -> Write/update in `spec-center/`.
3. **Module-specific spec** -> Write/update in the module's `docs/` directory.
4. **Cross-reference** - Module-specific specs must reference the shared specs they depend on. Use relative links like `[API Spec](../spec-center/conventions/xxx.md)`.
5. **docs/ sub-directories** - Each module's `docs/` MUST contain two sub-directories:
   - `docs/specs/` — Specification documents (data models, business rules, interface definitions, constraints — the "what")
   - `docs/plans/` — Implementation plans (technical designs, architecture decisions, migration strategies, development roadmaps — the "how")

## 3. Implementation Plans (Cross-Module Features)

Cross-module **specs** live in `spec-center/docs/specs/`; cross-module **plans** do **not**. Each implementing module gets its own plan under `<module>/docs/plans/`.

**Rule**: One plan per implementing module. Do **not** combine server + web (or other modules) into a single monolithic implementation plan.

| Document | Where | Example |
|---|---|---|
| Cross-module domain spec (what) | `spec-center/docs/specs/` | `2026-06-01-feature-design.md` |
| Server implementation plan (how) | `server/docs/plans/` | `2026-06-01-feature.md` |
| Web implementation plan (how) | `web/docs/plans/` | `2026-06-01-feature.md` |
| API / error-code contract updates | `spec-center/` (OpenAPI, error-codes) | Updated in spec or alongside server plan — **no** separate spec-center plan unless spec-center-only work |

**Plan structure:**

1. **Shared spec first** — Write and approve the cross-module spec in `spec-center` (API schemas, acceptance criteria, error codes).
2. **Split plans by module** — Create one plan per module that implements the feature. Use the same date + feature slug (e.g. `2026-06-01-feature.md`) for discoverability.
3. **Declare dependencies** — Each plan MUST link to the SSOT spec and, when applicable, state `Depends on: <other-module-plan>` (e.g. web plan depends on server plan).
4. **Execute in dependency order** — Typically `server` → `web` → `client`. A downstream plan MUST NOT assume upstream API changes exist until the upstream plan is merged or verified.
5. **No canonical plans in agent temp paths** — Module plans belong in `<module>/docs/plans/`, not in agent-only directories. Agent-generated drafts may start elsewhere but MUST be moved to the module path before execution.

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
web/docs/plans/2026-06-01-user-management.md            ← parent overview
web/docs/plans/2026-06-01-user-management--schema.md     ← data layer
web/docs/plans/2026-06-01-user-management--api-client.md ← API integration
web/docs/plans/2026-06-01-user-management--user-list.md  ← list page UI
web/docs/plans/2026-06-01-user-management--user-detail.md ← detail page UI; Depends on user-list
```

**Example (single module, no split needed):**

```
spec-center/docs/specs/2026-06-01-feature-design.md   ← SSOT spec
server/docs/plans/2026-06-01-feature.md               ← schema, API, tests
web/docs/plans/2026-06-01-feature.md                  ← UI; Depends on server plan
```

## 4. Spec Ownership Quick Reference

| What | Where |
|---|---|
| API endpoint definition | `spec-center/` |
| Cross-module domain spec | `spec-center/docs/specs/` |
| Cross-module implementation plan | **Split** — one plan per module in `<module>/docs/plans/` (see [Implementation Plans](#3-implementation-plans-cross-module-features)) |
| Error code and format | `spec-center/` |
| Response envelope | `spec-center/` |
| Convention documents (universal + language-specific) | `spec-center/conventions/` |
| Retry / circuit-breaker policy | `spec-center/` |
| Internal data model (not exposed via API) | Module's `docs/` |
| Internal algorithm or business logic | Module's `docs/` |
| Module implementation plan | Module's `docs/plans/` |
| Module deployment / ops config | Module's `docs/` |

## 5. Spec Document Index (Mandatory Maintenance)

When a spec document is **added or updated**, the corresponding AGENTS.md **MUST** be updated with a reference entry. This ensures LLMs and developers can discover and understand all active specs without scanning the filesystem.

**Rule**: No spec document should exist without being referenced in an AGENTS.md.

**Exception**: Requirement/feature spec documents under `docs/specs/` (in any module or in spec-center) do **not** need to be referenced in AGENTS.md. These specs are transient and numerous; the AGENTS.md index requirement applies to governing specs (API contracts, error codes, conventions, event schemas) only.

**How**:

1. **`spec-center/AGENTS.md`** — Maintain the "Spec Center as SSOT" bullet list and Repository Structure tree with actual filenames and relative links. Every file under `spec-center/` must appear in at least one of these two places.
2. **`<module>/AGENTS.md`** — Maintain a "Mandatory Specs" section listing all spec-center documents the module depends on, with relative links.

**Why**: AGENTS.md is the entry point for context-loading. If a spec is not referenced here, it is effectively invisible to agents and risks being ignored or contradicted.

## 相关 Skill

- 实现阶段的测试驱动流程与测试细则（TDD workflow、AAA、命名、覆盖率等）→ **`project-conventions`** 的 [references/testing.md](../project-conventions/references/testing.md)。
- 工程行为规范（think-before-code、simplicity-first、surgical-changes、root-cause reasoning 等）→ 独立 skill **`engineering-guidelines`**。
