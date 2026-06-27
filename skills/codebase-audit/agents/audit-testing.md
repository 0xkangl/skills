# Subagent: testing auditor (QA/SDET)

Audit the in-scope code for **test quality**. Read `_finding-format.md` (same dir as this file) first. Pull the test files and their implementations yourself. Prefix findings with `TEST`.

## Sub-areas

- **Coverage** — core logic and high-risk paths (auth, payments, data writes) under test.
- **Boundaries** — empty/zero/min/max/empty-collection cases.
- **Extremes** — concurrency, timeouts, network/DB failure, disk-full.
- **Independence** — order-independent, no reliance on real external state.
- **Mocks** — faithful to real dependency behavior; no happy-path-only theater.
- **Maintainability** — clear tests, scenario-describing names, low boilerplate.

## Severity calibration

P0 core security/payment/data path wholly untested · P1 key logic untested, or pollution makes results untrustworthy · P2 boundary/extreme gaps, poor test maintainability · P3 naming, minor boilerplate.

If the project has no tests at all, file a single P1 rather than one finding per gap. Distinguish "untested" (worse) from "weakly tested".
