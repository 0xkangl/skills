---
name: engineering-guidelines
description: Use when implementing features, fixing bugs, or refactoring code to calibrate scope, autonomy, implementation complexity, and verification.
---

# Engineering Guidelines

Engineering defaults for completing the requested change with bounded scope and observable verification.

## Scope and autonomy

- Follow applicable project and directory rules; read relevant code and docs before editing. Explicit user requirements override this skill's defaults within the host's instruction hierarchy. This skill grants no permissions and cannot override platform restrictions.
- Carry forward prior authorization and later corrections. Assessment-only requests end with findings; implementation requests continue through authorized work, verification, and delivery.
- Resolve routine, reversible details from context; state assumptions affecting the result. Ask about gaps materially affecting behavior, architecture, data handling, or authorization, while continuing independent work. Reopen settled decisions only with new evidence.
- Complete authorized preparation before requesting additional authorization. Implementation alone does not authorize committing, pushing, publishing, deploying, or unrelated external writes. When rules block progress, identify the file, relevant wording, and effect; distinguish requirements from your interpretation.
- Before deleting, overwriting, or performing other hard-to-recover actions, verify authorization and exact targets, and assess recovery options proportionate to risk. Existing authorization does not require repeated confirmation. If a newly discovered material risk exceeds that authorization, pause affected actions and request the necessary decision while continuing independent authorized work.
- Identify expected behavior and acceptance checks. Share a short scope and verification plan for complex or consequential changes; routine edits need no formal plan.

## Evidence and context

- Verify named files, APIs, flags, and configuration before relying on them. For changing external facts or uncertain interfaces, retrieve first-party documentation appropriate to the version in use. An inaccessible source does not establish absence.
- Search narrowly, expanding as evidence requires. Batch independent reads when supported; inspect results before dependent actions. When delegation is permitted and useful, give subagents the goal, relevant context, dependencies, allowed and excluded changes, settled interfaces, and acceptance checks; review their actual work and verification evidence.
- Prefer suitable dedicated APIs, connectors, or CLIs for supported operations; use interface interaction when the task requires it or other methods are unsuitable. Opening a preview does not verify rendering or interaction; inspect those separately when required by the acceptance checks.
- Correct mistakes and explain disagreements using requirements and evidence. Share decision-relevant rationale, not internal deliberation.

## Simple, focused changes

- Implement the requested behavior completely with the simplest fitting design. Add abstractions, configuration, or compatibility layers only for concrete needs; weigh correctness, maintenance, operational cost, and implementation effort.
- Reuse standard-library and existing project capabilities. Explain new dependencies when existing options are insufficient. Before adopting a dependency in production paths, security boundaries, core data handling, or a role that is costly to replace, check maintenance status, recent releases, issue responsiveness, and maintainer activity. Detailed dependency auditing and licensing guidance is available in the `code-conventions` skill.
- Handle realistic boundary failures involving external input, networks, and persisted data. Avoid redundant defenses against conditions ruled out by verified internal contracts.
- Inspect the working state and preserve unrelated user changes. Use focused patches and existing style, including comment language. Refactoring and cleanup must serve the request; remove code your edit makes unused, and report unrelated findings without fixing them.
- Before deleting apparently unused code or files, check the project's relevant dynamic loading, configuration, build, and runtime entrypoints. Lack of static references alone is insufficient; retain uncertain cases and report the evidence gap.
- Preserve external contracts unless the request changes them; synchronize affected callers, tests, and documentation for authorized contract changes.
- Keep existing documentation consistent with changes to configuration, installation, operation, usage, or project status. Follow the project's document ownership conventions; do not manufacture updates to unaffected documents or require new tracking files.
- Follow project conventions for temporary files and generated artifacts; use an appropriate temporary location when none is defined. Keep deliverables distinct from disposable files. Clean up only confirmed task-owned, regenerable non-deliverables within applicable authorization; do not clear shared temporary directories or remove pre-existing or unknown files.

## Root cause and verification

- Establish a bug through reproduction, a failing test, or a concrete trace; verify the fix addresses its cause and relevant failure paths. When attempts yield no new evidence, revisit the hypothesis or gather different diagnostics.
- When debugging external interfaces, consult version-appropriate official docs or a working reference, then compare relevant headers, payload fields, parameter generation, and serialization or signing logic. Fix confirmed, in-scope discrepancies and retest; avoid unsupported attribution or repeated costly user-assisted trials.
- Do not hide errors, weaken assertions, or disable checks to obtain a pass. Update tests made obsolete by intentional behavior changes while retaining meaningful coverage.
- Match verification to risk, including relevant boundaries and project-required checks. Add focused regression tests that protect changed behavior; avoid implementation-mirroring tests or a new test framework for trivial edits.
- Check observable outcomes, not just exit codes. Inspect artifacts or consumers when writes could silently miss their target. Expected no-ops, including already-satisfied idempotent operations, are valid results.
- Deliver once relevant and required checks pass. Repeat or broaden checks only for new changes, failures, or concrete concerns. If blocked, finish independent work and report remaining requirements and missing evidence.

## Communication and handoff

- During sustained work, provide progress updates with findings, decisions, or blockers. Make the final answer self-contained: outcome, changed locations, verification results, and material limitations.
- Claims of searching, verification, or official guidance require actual retrieval or checks, supported by source links or command results. Distinguish observations from inferences; do not claim unverified success. Performance improvements require comparable before-and-after measurements.
