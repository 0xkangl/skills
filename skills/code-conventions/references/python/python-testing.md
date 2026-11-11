# Python Testing Convention v1.0

> Applies to: 所有 Python 模块 | Goal: 用 pytest 写确定性、隔离、可读的测试，覆盖业务逻辑与边界

For the full convention index, see [../../SKILL.md](../../SKILL.md).

在通用 [testing.md](../testing.md) 之上扩展 Python 专项。框架统一用 **pytest**。

## 目录

- [1. Structure (AAA)](#1-structure-aaa)
- [2. Naming](#2-naming)
- [3. Fixtures](#3-fixtures)
- [4. Parametrize](#4-parametrize)
- [5. Categorization](#5-categorization)
- [6. Mocking Philosophy](#6-mocking-philosophy)
- [7. Coverage](#7-coverage)
- [8. Determinism & Isolation](#8-determinism--isolation)
- [9. Checklist](#9-checklist)

## 1. Structure (AAA)

每个测试遵循 Arrange–Act–Assert，一个测试只验证一个行为：

```python
def test_calculate_total_applies_discount():
    # Arrange
    cart = Cart(items=[Item(price=100), Item(price=50)])
    # Act
    total = cart.total(discount=0.1)
    # Assert
    assert total == 135
```

## 2. Naming

- 文件 `test_*.py`，函数 `test_<行为>_<条件>`，名字描述期望行为。
- 测试名读起来像规格：`test_returns_none_when_user_missing`。

## 3. Fixtures

- 用 `@pytest.fixture` 提供依赖与测试数据，`yield` 做清理。
- 合理设 `scope`（`function` 默认 / `module` / `session`），避免跨测试共享可变状态。
- 共享 fixture 放 `conftest.py`。

```python
@pytest.fixture
def db_session():
    session = create_test_session()
    yield session
    session.rollback()
    session.close()
```

## 4. Parametrize

用 `@pytest.mark.parametrize` 做表驱动，覆盖多输入而不复制测试体：

```python
@pytest.mark.parametrize("value, expected", [
    ("", False),
    ("a@b.com", True),
    ("no-at", False),
])
def test_is_valid_email(value, expected):
    assert is_valid_email(value) is expected
```

## 5. Categorization

用 mark 分类，便于分层运行：

```python
@pytest.mark.unit
def test_pure_logic(): ...

@pytest.mark.integration
def test_database_roundtrip(): ...

@pytest.mark.e2e
def test_user_checkout_flow(): ...
```

在 `pyproject.toml` 的 `markers` 中注册 unit / integration / e2e；`--strict-markers` 仅校验 mark 是否已注册，测试选择由 `-m` 完成。默认 `addopts` 设置 `-q --strict-markers -m "not integration and not e2e"`，配置见 [python-tools.md](python-tools.md)。所有依赖外部服务的测试必须标为 integration / e2e。

```bash
pytest -m unit                         # 只跑显式标为 unit 的快测
pytest -m "not integration and not e2e" # 默认测试范围，含未标记的单元测试
pytest -m "integration and not e2e"     # 显式 opt-in，或 make test-integration
pytest -m e2e                          # 显式运行端到端测试
```

命令行 `-m` 会覆盖 `addopts` 中的默认表达式，集成测试入口不会被默认过滤再次排除；其他默认参数仍生效。参见 [pytest 参数优先级说明](https://docs.pytest.org/en/stable/example/simple.html#how-to-change-command-line-options-defaults)。

## 6. Mocking Philosophy

- **优先真实对象 / 内存实现 fake**，mock 只用于外部边界（网络、第三方 SDK、时间）。
- 用 `unittest.mock` / `pytest-mock` 的 `mocker`，patch **使用处**而非定义处。
- 不 mock 被测对象自身的内部方法——那是在测实现而非行为。
- 异步用 `AsyncMock`，时间用 `freezegun` / 注入 clock。

## 7. Coverage

```bash
pytest -m "not integration and not e2e" --cov=src --cov-report=term-missing
```

- 业务逻辑覆盖率目标 ≥ 80%；纯工具函数更高。
- 关注分支与异常路径，而非单纯行覆盖率数字。
- 覆盖率低于阈值在 CI 中阻断。

## 8. Determinism & Isolation

- 测试不依赖时钟、随机、外部服务状态；需要时注入或 mock。
- 测试间无共享可变状态、无顺序依赖。
- 集成测试用独立测试库 / 容器，跑完回滚或清理。
- 默认测试及覆盖率不连接外部服务。连接、容器启动等操作放在 integration / e2e 测试专用的 fixture 中，不能在模块导入、收集阶段或默认 autouse fixture 中触发。

## 9. Checklist

- [ ] 遵循 AAA，一测一行为，命名描述行为。
- [ ] 依赖经 fixture 提供并清理，无跨测试共享可变状态。
- [ ] 多输入用 `parametrize`，不复制测试体。
- [ ] 用 mark 分层并注册，默认测试 / 覆盖率排除 integration 与 e2e，集成测试显式 opt-in。
- [ ] 外部服务仅在所选测试的专用 fixture 中连接，默认运行及收集无外部服务副作用。
- [ ] mock 仅限外部边界，patch 使用处。
- [ ] 覆盖业务分支与异常路径，覆盖率达标。
