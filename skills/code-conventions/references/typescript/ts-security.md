# TypeScript / JavaScript Security Convention v1.0

> Applies to: 所有 TypeScript 与 JavaScript 模块 | Goal: 在通用安全基线上落实 TS/JS 的密钥、注入、原型链与依赖审计实践

For the full convention index, see [../../SKILL.md](../../SKILL.md).

在通用 [security.md](../security.md) 之上扩展。前端 React 专项见 [react-security.md](../react/react-security.md)。

## 1. Secret Management

```typescript
// Bad —— 硬编码
const apiKey = 'sk-proj-xxxxx'

// Good —— 环境变量 + 启动校验
const apiKey = process.env.API_KEY
if (!apiKey) throw new Error('API_KEY not configured')
```

- 密钥从 `process.env` 读取，缺失 fail-fast。
- **前端 bundle 绝不含服务端密钥**——任何打进客户端的值都视为公开（`NEXT_PUBLIC_*` / `VITE_*` 前缀只放可公开值）。
- `.env` 必须 `.gitignore`；命名与双前缀见 [configuration.md](../configuration.md)。

## 2. Injection Prevention

- **SQL**：用参数化查询 / ORM（Prisma、Drizzle）绑定参数，绝不模板串拼接。
- **XSS**：输出到 DOM 前转义；框架默认转义不要绕过（避免 `innerHTML`、`dangerouslySetInnerHTML` 直传用户内容）。
- **命令**：`child_process` 用参数数组形式，不用 `exec` 拼接用户输入。
- **SSRF**：服务端对用户提供的 URL 校验 scheme / host 后再请求。

## 3. Prototype Pollution

- 合并 / 深拷贝不可信对象时防 `__proto__` / `constructor` 污染。
- 用 `Object.create(null)` 建无原型字典，或用 `Map`；用经审计的合并库。
- 不把用户可控键直接写入对象作为属性名而不校验。

## 4. Input Validation

边界用 **zod**（或 valibot）做 schema 校验，并从 schema 推断类型：

```typescript
import { z } from 'zod'

const userSchema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
})
type UserInput = z.infer<typeof userSchema>

const user = userSchema.parse(input)   // 失败抛错，类型自动收窄
```

## 5. Dependency Audit

```bash
pnpm audit          # 或 npm audit
```

- 锁文件入库，CI 中将高危漏洞设为阻断项。
- 谨慎引入传递依赖；优先维护活跃、体积小的包。

## 6. Web Hardening

- 服务端响应设安全头（CSP、`X-Content-Type-Options`、`Strict-Transport-Security`）。
- Cookie 设 `HttpOnly` / `Secure` / `SameSite`。
- 所有外部 `fetch` 设超时与错误处理。

## 7. Checklist

- [ ] 密钥从 `process.env` 读取、fail-fast，前端 bundle 不含服务端密钥。
- [ ] SQL 参数化 / ORM；HTML 输出转义，未绕过默认转义。
- [ ] 防原型链污染（无裸 `__proto__` 合并）。
- [ ] 边界用 zod 校验并推断类型。
- [ ] `pnpm audit` 通过，CI 阻断高危。
- [ ] 安全响应头与 Cookie 属性配置到位。
