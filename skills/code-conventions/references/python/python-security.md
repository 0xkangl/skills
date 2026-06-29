# Python Security Convention v1.0

> Applies to: 所有 Python 模块 | Goal: 在通用安全基线上落实 Python / FastAPI 的密钥、注入、校验与扫描实践

For the full convention index, see [../../SKILL.md](../../SKILL.md).

在通用 [security.md](../security.md) 之上扩展 Python 专项。

## 1. Secret Management

```python
import os

api_key = os.environ["OPENAI_API_KEY"]  # 缺失即 KeyError，启动期暴露
```

- 密钥从环境读取，缺失 fail-fast（用 `os.environ[...]` 而非 `os.getenv` 带默认值）。
- 本地用 `.env` + `python-dotenv`，`.env` 必须 `.gitignore`。
- 绝不硬编码密钥；命名与双前缀见 [configuration.md](../configuration.md)。

## 2. Injection Prevention

- **SQL**：用 ORM 绑定参数或参数化查询，**绝不**用 f-string / `%` 拼接 SQL。

```python
# Bad —— SQL 注入
cursor.execute(f"SELECT * FROM users WHERE email = '{email}'")

# Good —— 参数化
cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
# SQLAlchemy: session.execute(select(User).where(User.email == email))
```

- **命令**：不用 `os.system` / `shell=True` 拼接用户输入；用 `subprocess.run([...], shell=False)` 传参数列表。
- **反序列化**：不对不可信数据用 `pickle` / `yaml.load`（用 `yaml.safe_load`）。
- **SSRF**：对用户提供的 URL 校验 scheme / host 后再请求。

## 3. Input Validation

- 边界用 **pydantic** 模型校验，优先字段约束（`Field(..., max_length=...)`）而非手写校验。
- FastAPI 端点用 `response_model` 控制输出，**绝不**把密码哈希、access/refresh token、内部认证态放进响应模型。

```python
from pydantic import BaseModel, EmailStr, Field

class CreateUser(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12)

class UserOut(BaseModel):       # 响应模型不含敏感字段
    id: str
    email: EmailStr
```

## 4. Web / FastAPI Hardening

- CORS origins 按环境配置；**绝不**把通配 `*` 与凭据型 CORS 组合。
- JWT 校验 expiry / issuer / audience / algorithm，固定算法白名单。
- 认证与写密集端点加限流。
- 日志脱敏 cookie、`Authorization` 头、token、凭据（见 [observability.md](../observability.md)）。

## 5. Security Scanning

```bash
bandit -r src/        # 静态安全分析
pip-audit             # 依赖已知漏洞
```

- CI 中将高危发现设为阻断项。
- 锁文件入库，定期审计依赖（见 [python-tools.md](python-tools.md)）。

## 6. Checklist

- [ ] 密钥从环境读取、缺失 fail-fast，`.env` 已 gitignore。
- [ ] SQL 全参数化 / ORM 绑定，无字符串拼接。
- [ ] 无 `shell=True` 拼接、无不可信 `pickle` / `yaml.load`、SSRF 已防。
- [ ] 边界用 pydantic 校验，响应模型不含敏感字段。
- [ ] CORS 不通配 + 凭据；JWT 校验完整；敏感端点限流。
- [ ] bandit + pip-audit 通过，CI 阻断高危。
