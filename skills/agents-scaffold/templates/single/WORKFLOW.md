# Development Workflow — {{PROJECT}}

Load this document when work involves specifications, contracts, implementation plans, or TDD. The concise defaults in [AGENTS.md](./AGENTS.md#development-workflow) govern all other work.

## Choosing the workflow

- Routine, reversible changes with clear scope may proceed directly. Do not create a spec or plan only to satisfy a template.
- Update a spec before implementing material behavior or contract changes, architecture, data handling, or migrations.
- Write an implementation plan when the change is complex or consequential enough that dependencies, sequencing, or acceptance checks need a durable review artifact.
- Request review when required by the user or project process, or when an unresolved choice materially changes the outcome. Existing authorization carries forward.

## Specifications and tests

For changes that require a spec:

1. Update the governing contract under `docs/` or the feature/design spec under `docs/specs/`.
2. Record observable acceptance criteria.
3. Implement against the accepted requirements.

Choose tests and other checks in proportion to risk. Prefer a focused failing regression test before implementation when it can demonstrate new or corrected behavior. Documentation, configuration, generated output, and low-impact mechanical changes may be verified directly when a mirrored test would add no signal. Once tests are warranted, follow the `code-conventions` skill for structure, naming, mocks, coverage, and integration boundaries.

## Implementation plans

When a durable plan is warranted:

1. Store it as `docs/plans/YYYY-MM-DD-feature.md`.
2. State the goal, scope, dependencies, steps, and observable acceptance criteria.
3. Link the governing spec when one exists and declare `Depends on: <other-plan>` where sequencing matters.
4. Split a large plan into a parent plus `YYYY-MM-DD-feature--<scope>.md` sub-plans only when each sub-plan is independently reviewable and testable.

Do not create plans for routine edits, and do not split a plan into trivial fragments.
