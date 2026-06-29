# Python Style and Idioms Convention v1.0

> Applies to: 所有 Python 模块 | Goal: 统一 Python 风格、类型注解、不可变与惯用法，写出符合 PEP 8 / PEP 484 的地道代码

For the full convention index, see [../../SKILL.md](../../SKILL.md).

在通用 [coding-style.md](../coding-style.md) 与 [patterns.md](../patterns.md) 之上扩展 Python 专项。工具链见 [python-tools.md](python-tools.md)，测试见 [python-testing.md](python-testing.md)，安全见 [python-security.md](python-security.md)。

## 1. Formatting

- 遵循 **PEP 8**；格式化交给工具（black + ruff），不手动纠缠空格。见 [python-tools.md](python-tools.md)。
- 4 空格缩进，行宽随 black 默认（88）。
- import 顺序：标准库 → 第三方 → 本地，三组间空行，由 isort/ruff 自动排序。

## 2. Type Annotations

- **所有函数签名 MUST 带类型注解**（参数 + 返回值），包括返回 `None`。
- 用现代语法：`list[str]`、`dict[str, int]`、`X | None`（Py 3.10+），不再用 `typing.List` / `Optional[X]`。
- 公共 API 注解完整；局部显而易见的变量可省略。
- 对外部 / 不可信输入用 `object` 或具体类型 + 校验，避免滥用 `Any`。

```python
def format_user(user: User) -> str:
    return f"{user.first_name} {user.last_name}"

def find_user(user_id: str) -> User | None:
    ...
```

## 3. Immutability

优先不可变数据结构，减少隐藏副作用：

```python
from dataclasses import dataclass
from typing import NamedTuple

@dataclass(frozen=True, slots=True)
class User:
    name: str
    email: str

class Point(NamedTuple):
    x: float
    y: float
```

- DTO / 值对象用 `@dataclass(frozen=True)` 或 `NamedTuple`。
- 不在函数内原地修改入参容器；需要变更时返回新对象或副本。
- 不用可变默认参数（`def f(x: list = [])` 是经典陷阱），用 `None` 哨兵。

## 4. Idioms

- **推导式**优于手写循环建集合：`[x for x in xs if pred(x)]`；过于复杂则退回普通循环。
- **上下文管理器**（`with`）管理资源（文件、连接、锁），确保释放。
- **生成器**做惰性 / 大数据迭代，省内存。
- **EAFP** 优于 LBYL：`try/except` 表达「先做后处理异常」比层层前置检查更地道。
- 用 `enumerate` / `zip` / `itertools`，不用手动维护索引。
- 真值判断用 `if not items:`，不用 `if len(items) == 0:`。

## 5. Error Handling

- 抛**具体**异常类型，不裸 `raise Exception`；按域定义异常类。
- `except` 捕获最窄的类型；禁止裸 `except:` 吞掉所有异常（含 `KeyboardInterrupt`）。
- 不静默吞错：要么处理、要么 `raise`，需要换语义时用 `raise NewError(...) from err` 保留链。
- 清理逻辑放 `finally` 或上下文管理器。

```python
# Bad
try:
    do()
except:               # 吞掉一切，连中断都吃
    pass

# Good
try:
    do()
except ValueError as err:
    raise DomainError("invalid input") from err
```

## 6. Structure & Patterns

- 用 `typing.Protocol` 做结构化子类型（鸭子类型接口），解耦实现，见 [patterns.md](../patterns.md)。
- 业务依赖经构造函数注入，不在内部硬构造或读全局。
- 模块按领域组织；`__init__.py` 控制导出面，内部细节加 `_` 前缀。
- 避免在导入期执行副作用（建连接、读环境）；入口处显式初始化。

```python
from typing import Protocol

class UserRepository(Protocol):
    def find_by_id(self, user_id: str) -> User | None: ...
    def save(self, user: User) -> User: ...
```

## 7. Async

- I/O 密集端点用 `async def` + 异步客户端（httpx、async SQLAlchemy）。
- **绝不**在 async 函数里调用阻塞调用（`requests`、同步 DB session、阻塞文件 IO）——会阻塞事件循环；需要时用 `run_in_executor`。
- 用 `asyncio.gather` 并发独立 IO，注意异常传播。

## 8. Checklist

- [ ] 所有函数签名带类型注解，用 `X | None` / `list[str]` 现代语法。
- [ ] DTO / 值对象不可变（`frozen` dataclass / NamedTuple），无可变默认参数。
- [ ] 优先推导式 / 上下文管理器 / 生成器等惯用法。
- [ ] 异常具体、捕获最窄，无裸 `except`、无静默吞错。
- [ ] 接口用 `Protocol`，依赖注入，无导入期副作用。
- [ ] async 路径无阻塞调用。
- [ ] 通过 black + ruff + mypy（见 python-tools.md）。
