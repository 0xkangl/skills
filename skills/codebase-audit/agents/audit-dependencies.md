# Subagent: dependencies & tech-debt auditor

Audit the in-scope code for **dependency health and technical debt**. Read `agents/_finding-format.md` first. Pull the manifest(s) (go.mod, package.json, requirements.txt, pom.xml…) and grep the source yourself. Prefix findings with `DEP`.

## Sub-areas

- **Dependency health** — unmaintained (>2y) deps, pinned vs ranged versions.
- **Tech debt** — TODO/FIXME/HACK/XXX density and location, large commented-out blocks, long-lived "temporary" code.
- **Dead code** — uncalled functions, unreachable branches, abandoned endpoints.
- **Version consistency** — one dep at differing versions across modules, conflicting transitive deps.

## Severity calibration

P0 dependency with a known severe CVE (cross-links with security) · P1 badly outdated core dep, dead code obscuring a key flow, version conflict causing nondeterminism · P2 debt clustered in important modules, unlocked versions · P3 scattered commented code, minor lag, harmless dead functions.
