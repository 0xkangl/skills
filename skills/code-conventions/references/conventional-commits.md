# Conventional Commits

> Git commit message convention. Applies to all modules.

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
- Imperative mood, ≤72 chars, no trailing period. What doesn't fit goes in the body — the subject still names the module and the behavior.

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
