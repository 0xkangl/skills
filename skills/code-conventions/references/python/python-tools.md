# Python Tooling Convention v1.0

> Applies to: 所有 Python 模块 | Goal: 统一格式化、lint、类型检查、依赖与打包工具，让本地与 CI 行为一致

For the full convention index, see [../../SKILL.md](../../SKILL.md).

风格规则见 [python-style.md](python-style.md)。本篇定工具链与配置。统一入口为 `pyproject.toml`。

## 1. Toolchain

| 关注点 | 工具 | 说明 |
|---|---|---|
| 格式化 | **black** | 唯一格式化器，零配置争议 |
| Lint + import 排序 | **ruff** | 替代 flake8 / isort / pyupgrade，极快；开启 isort 规则 |
| 类型检查 | **mypy** 或 **pyright** | 二选一，CI 阻断；新项目推荐 pyright（快、严格） |
| 安全扫描 | **bandit** / **pip-audit** | 见 [python-security.md](python-security.md) |
| 测试 | **pytest** | 见 [python-testing.md](python-testing.md) |
| 依赖 / 打包 | **uv**（推荐）或 **poetry** | 锁文件入库；不用裸 `pip install` 管理项目依赖 |
| Git 钩子 | **pre-commit** | 提交前自动跑 black/ruff/mypy |

## 2. pyproject.toml

所有工具配置集中在 `pyproject.toml`，不散落多个点文件：

```toml
[tool.ruff]
line-length = 88
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]  # 含 isort(I)、bugbear(B)、pyupgrade(UP)

[tool.mypy]
python_version = "3.12"
strict = true                # 严格模式全开
warn_unused_ignores = true

[tool.pytest.ini_options]
addopts = "-q --strict-markers"
markers = ["unit", "integration"]
```

## 3. Dependency Management

- 用 **uv** / **poetry** 管理依赖与虚拟环境，锁文件（`uv.lock` / `poetry.lock`）入库保证可复现。
- 区分运行时依赖与开发依赖（`--dev`）。
- 固定关键依赖版本；定期 `pip-audit` 扫漏洞（见 python-security.md）。

## 4. Pre-Commit

`.pre-commit-config.yaml` 串联格式化与检查，本地提交即拦截问题：

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.11.0
    hooks:
      - id: mypy
```

## 5. Makefile / Task Runner

提供统一命令入口，CI 与本地共用：

```makefile
fmt:   ; ruff check --fix . && ruff format .
lint:  ; ruff check . && mypy .
test:  ; pytest --cov=src --cov-report=term-missing
audit: ; pip-audit && bandit -r src/
check: fmt lint test
```

## 6. Checklist

- [ ] 配置集中在 `pyproject.toml`。
- [ ] black + ruff（含 isort 规则）+ mypy/pyright strict 全绿。
- [ ] 依赖经 uv/poetry 管理，锁文件入库。
- [ ] pre-commit 钩子已装并通过。
- [ ] 提供统一 `make`（或等价）命令入口。
