# Development Workflow — {{PROJECT}}

Load this document when work involves specifications, contracts, implementation plans, TDD, or sequencing across modules. The concise defaults in [AGENTS.md](./AGENTS.md#development-workflow) govern all other work.

## Choosing the workflow

- Routine, reversible changes with clear scope may proceed directly. Do not create a spec or plan only to satisfy a template.
- Update a spec before implementing material behavior or contract changes, cross-module interfaces, architecture, data handling, or migrations.
- Write an implementation plan when the change is complex or consequential enough that dependencies, sequencing, or acceptance checks need a durable review artifact.
- Request review when required by the user or project process, or when an unresolved choice materially changes the outcome. Existing authorization carries forward.

## Specifications and tests

For changes that require a spec:

1. Update the shared spec in `{{PROJECT}}-spec-center` or the local spec in the owning module.
2. Record observable acceptance criteria and affected contracts.
3. Implement against the accepted requirements.

Choose tests and other checks in proportion to risk. Prefer a focused failing regression test before implementation when it can demonstrate new or corrected behavior. Documentation, configuration, generated output, and low-impact mechanical changes may be verified directly when a mirrored test would add no signal. Once tests are warranted, follow the `code-conventions` skill for structure, naming, mocks, coverage, and integration boundaries.

## Contract changes

Each module is independently released, so contract changes must remain compatible while consumers migrate.

1. Identify every known consumer in the governing spec or tracked ROADMAP item.
2. Classify the change:
   - **Additive**: add optional fields or endpoints, or widen accepted values. Verify old consumers still work without code changes.
   - **Breaking**: remove or rename fields, change types or meanings, narrow accepted values, or make optional data required. Version the interface or use expand-contract: support old and new forms, migrate consumers, then remove the old form.
3. Never reuse an existing field name for a new meaning.
4. Verify real serialized payloads and relevant consumers; one module's passing tests do not establish cross-module compatibility.

For storage changes, follow the database migration guidance in the `code-conventions` skill.

## Cross-module plans

Cross-module specs live in `{{PROJECT}}-spec-center/specs/`; implementation plans live with the modules that execute them.

1. Create one plan per implementing module under `<module>/docs/plans/` when a durable plan is warranted.
2. Use the same `YYYY-MM-DD-feature.md` name across related module plans.
3. Link every module plan to the governing shared spec and declare `Depends on: <other-module-plan>` where sequencing matters.
4. Execute in dependency order. Do not assume an upstream interface exists until it is merged or otherwise verified.
5. Split a large module plan into a parent plus `YYYY-MM-DD-feature--<scope>.md` sub-plans only when each sub-plan is independently reviewable and testable.

A single cross-module plan is acceptable only for a small atomic change with no meaningful dependency boundary. Canonical plans belong in module `docs/plans/`, not agent-temporary paths.
