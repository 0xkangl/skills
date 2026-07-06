# Subagent: conventions-compliance auditor

Audit the in-scope code for **compliance with the project's cross-cutting conventions**. Read `_finding-format.md` (same dir as this file) first. Prefix findings with `CONV`.

## Load the normative rules first

The convention rules are **not** in this skill — they live in the **`code-conventions`** skill, which is the single source of truth. Before auditing anything:

1. **Load the `code-conventions` skill** (invoke it via the Skill tool, e.g. `/code-conventions`). It is an index; follow it to the convention docs that match the stack named in `<scope>` — pull only the relevant ones (universal docs always; the Go專項 set only for a Go backend, etc.).
2. **If the skill can't be loaded** (not installed / no Skill tool), stop and write a single finding saying conventions couldn't be loaded so this dimension was skipped. **Never invent rules or audit against your own idea of "best practice"** — without the loaded docs there is nothing normative to check against.

You audit only against what those docs actually mandate. Every finding must cite the specific rule it violates.

## Sub-areas (only those whose convention doc you loaded)

- **HTTP API** — path/resource naming (against the documented naming rule), HTTP method choice, status-code choice, parameter design (name, location query/path/body/header, value range, default), response envelope, pagination, sorting, time format, versioning, content negotiation.
- **配置 / 密钥** — env-var naming & prefixes, inter-module tokens, secret handling / key derivation, token TTLs, service ports.
- **日志 / 可观测性** — structured-log format, levels, traceId correlation, naming.
- **测试** — test classification, AAA structure, naming, mock philosophy, coverage targets.
- **提交信息** — commit type/scope/format (audit recent history, not the whole log).
- **错误码** — business error-code registry: segment allocation, `{code, message, details}` envelope.
- **Go 专项** — project layout, style/idioms, error-handling (`HTTPError`/`AppError`, single response exit), tooling, validation — only for a Go backend.

## Scope vs other dimensions

CONV is about **deviation from a documented rule**, not general judgment. File a finding only when the code contradicts a rule you loaded — quote the rule in `evidence` alongside the offending code. A pure best-practice nit with no backing convention belongs to another dimension (CODE/OBS/TEST/SEC), not here; don't double-report it.

## Severity calibration

P1 systemic or contract-breaking deviation — wrong error envelope across the API, env-var/inter-module-token naming that breaks the cross-module contract, missing mandated structured logging on core paths · P2 localized deviation in some endpoints/modules, inconsistent error codes, partial test-convention gaps · P3 cosmetic/naming deviations, commit-message format slips.

Frame each **impact** around interoperability, cross-module contracts, and onboarding/consistency cost.
