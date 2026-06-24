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
