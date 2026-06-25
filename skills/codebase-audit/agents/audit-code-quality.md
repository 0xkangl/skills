# Subagent: code-quality auditor

Audit the in-scope code for **code quality**. Read `agents/_finding-format.md` first. Pull the business-logic source yourself (services, handlers, workers, utils). Prefix findings with `CODE`.

## Sub-areas

- **Correctness** — conditionals, boundary values, type-conversion and overflow risks.
- **Completeness** — branch coverage (switch/if-else defaults, nil checks).
- **Clarity** — function length (~≤50 lines), nesting depth (~≤3), naming.
- **Comments** — rationale on complex logic; doc comments on public APIs.
- **Formatting** — conformance to the language standard (gofmt/black/eslint…).
- **Duplication** — DRY violations, extractable shared logic, needless allocations.
- **Concurrency** — lock coverage of shared state, races, correct channel use.
- **Error handling** — swallowed errors, context-less wrapping, misused panic.
- **Readability** — self-explanatory names, consistent abstraction level, no "clever" code.

## Severity calibration

P0 logic bug corrupting data, race causing crashes · P1 flaw breaking a core feature, silently swallowed error · P2 duplication, long functions, weak readability · P3 naming/formatting/minor optimization.
