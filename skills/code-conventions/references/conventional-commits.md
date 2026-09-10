# Conventional Commits

> Git commit message convention. Applies to all modules.

This document governs message content, not permission to commit or publish. For staging, authorization, branches, and ignore rules, see [repository-workflow.md](repository-workflow.md).

## Format

Strictly follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

## Types

| Type | Purpose |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `spec` | Specification-only changes |
| `style` | Formatting changes (no logic changes) |
| `refactor` | Code refactoring (neither a feature nor a fix) |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `build` | Build system or external dependency changes |
| `ci` | CI configuration changes |
| `chore` | Maintenance tasks (no src or test changes) |
| `revert` | Revert a previous commit |

## Subject

- Say what changed, why, and what it affects. Vague subjects are not acceptable.
- ❌ `fix: fix bug` / `refactor: optimize code` / `chore: adjust` / `feat: update` — these carry no information in `git log`.
- ✅ `fix(notifier): return a non-zero exit code when push fails, so main stops reporting success`
- ≤72 chars, no trailing period. What doesn't fit goes in the body — the subject still names the module and the behavior.
- Follow the project's language convention; use imperative mood where appropriate to that language. Do not impose Chinese-only or English-only messages. Authorship and co-author trailers follow explicit user and project requirements; neither invent authors nor impose a universal ban on attribution.

## Examples

```
spec(api): add endpoint specification
```

```
feat(server): add user registration endpoint

Implement POST /users with request validation and
error handling per http-constitution spec.
```

```
fix(web): resolve pagination offset calculation

Fixes #123
```
