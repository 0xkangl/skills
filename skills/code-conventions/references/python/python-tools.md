# Python Tooling Convention v1.0

> Applies to: 所有 Python 模块 | Goal: 统一格式化、lint、类型检查、依赖与打包工具，让本地与 CI 行为一致

For the full convention index, see [../../SKILL.md](../../SKILL.md).

风格规则见 [python-style.md](python-style.md)。本篇定工具链与配置。统一入口为 `pyproject.toml`。

## 目录

- [1. Toolchain](#1-toolchain)
- [2. pyproject.toml](#2-pyprojecttoml)
- [3. Dependency Management](#3-dependency-management)
- [4. Pre-Commit](#4-pre-commit)
- [5. Makefile / Task Runner](#5-makefile--task-runner)
- [6. Checklist](#6-checklist)

## 1. Toolchain

| 关注点 | 工具 | 说明 |
|---|---|---|
| 格式化 | **black** | 唯一格式化器，零配置争议 |
| Lint + import 排序 | **ruff** | 替代 flake8 / isort / pyupgrade，极快；开启 isort 规则 |
| 类型检查 | **mypy** 或 **pyright** | 二选一，CI 阻断；新项目推荐 pyright（快、严格） |
| 安全扫描 | **bandit** / **pip-audit** | 见 [python-security.md](python-security.md) |
| 测试 | **pytest** | 见 [python-testing.md](python-testing.md) |
| 依赖 / 打包 | **uv**（推荐）或 **poetry** | 锁文件入库；不用裸 `pip install` 管理项目依赖 |
| Git 钩子 | **pre-commit** | 提交前自动跑 ruff、black 与所选类型检查器 |

## 2. pyproject.toml

所有工具配置集中在 `pyproject.toml`，不散落多个点文件：

以下配置与 hook 中的版本数值均为示例，包括 Python 3.12、Ruff v0.6.0、mypy v1.11.0 与 Black 24.8.0。采用时按项目已声明版本、锁文件及 CI 支持范围替换，保持工具版本固定；不要为套用示例升级依赖。

```toml
[tool.black]
line-length = 88
target-version = ["py312"]

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
addopts = '-q --strict-markers -m "not integration and not e2e"'
markers = [
    "unit: 不依赖外部服务的单元测试",
    "integration: 显式选择运行的集成测试",
    "e2e: 显式选择运行的端到端测试",
]
```

`markers` 注册分类，`--strict-markers` 拒绝未注册的 mark；实际选择测试由 `-m` 完成。默认排除 integration / e2e，显式入口见下方及 [python-testing.md](python-testing.md)。类型检查示例使用 mypy；选择 pyright 的项目沿用其 strict 配置，并同步替换下方 hook 与 `lint` 命令。

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
  - repo: https://github.com/psf/black
    rev: 24.8.0  # 可用的示例版本；按项目已声明版本与 CI 支持范围替换并固定
    hooks:
      - id: black
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.11.0
    hooks:
      - id: mypy
```

## 5. Makefile / Task Runner

提供统一命令入口，CI 与本地共用：

```makefile
fmt:              ; ruff check --fix . && black .
lint:             ; ruff check . && black --check . && mypy .
test:             ; pytest -m "not integration and not e2e" --cov=src --cov-report=term-missing
test-integration: ; pytest -m "integration and not e2e"
audit:            ; pip-audit && bandit -r src/
check: fmt lint test
```

Ruff 只负责 lint / import 排序，Black 负责格式化。`make test-integration` 的命令行 `-m` 覆盖 `addopts` 中的默认选择表达式，保留 `--strict-markers`；默认 `pytest`、`make test` 与 `make check` 均不运行 integration / e2e。外部连接只在显式选中测试的 fixture 内建立，不在导入、收集阶段或默认 autouse fixture 中连接服务。

## 6. Checklist

- [ ] 配置集中在 `pyproject.toml`。
- [ ] Black 是唯一格式化器；Ruff 仅 lint / import 排序；mypy/pyright strict 全绿。
- [ ] 依赖经 uv/poetry 管理，锁文件入库。
- [ ] pre-commit 钩子已装并通过。
- [ ] 提供统一 `make`（或等价）命令入口。
- [ ] 默认测试 / 覆盖率排除 integration 与 e2e，不连接外部服务；集成测试有显式入口。
