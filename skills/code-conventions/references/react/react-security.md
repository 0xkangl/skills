# React Security Convention v1.0

> Applies to: 所有 React 组件与服务端动作 | Goal: 防 XSS、URL 注入、密钥泄露与服务端动作越权，前端不可信任为信任边界

For the full convention index, see [../../SKILL.md](../../SKILL.md).

在 [ts-security.md](../typescript/ts-security.md) 与通用 [security.md](../security.md) 之上扩展 React 专项。

## 1. XSS via `dangerouslySetInnerHTML`

**CRITICAL**——这个 prop 名字故意吓人，每次出现都当 review 拦截点：

```tsx
// 危险：未净化的用户输入
<div dangerouslySetInnerHTML={{ __html: userBio }} />

// 正确 1：当文本渲染（React 自动转义）
<div>{userBio}</div>

// 正确 2：必须渲染 HTML 时先用 DOMPurify 净化
import DOMPurify from 'isomorphic-dompurify'
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userBio) }} />
```

审查每处调用：输入来源是否受控？用户来源是否在**同一调用点**净化？净化器是否用**白名单**标签而非黑名单？

## 2. Unsafe URL Schemes

`javascript:` / `data:` URL 出现在 `href` / `src` 会执行任意代码。React 仅开发态警告，运行时不拦——必须校验：

```tsx
function safeUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return url
  } catch {
    return undefined
  }
  return undefined
}
<a href={safeUrl(user.website)}>Visit</a>
```

`target="_blank"` 必须配 `rel="noopener noreferrer"`，防 `window.opener` 劫持（别依赖浏览器默认）。

## 3. Secret Exposure via Env Vars

带公开前缀的环境变量会打进客户端 bundle，视为公开：

| 框架 | 公开前缀（会进 bundle） |
|---|---|
| Next.js | `NEXT_PUBLIC_*` |
| Vite | `VITE_*` |
| CRA | `REACT_APP_*` |

```ts
// CRITICAL：密钥泄进客户端 bundle
const apiKey = process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY
```

每个改动 env 的 PR 都自问：这串值出现在公开 bundle 里有问题吗？服务端密钥绝不加公开前缀。

## 4. Server Action Hardening

Server Action（`"use server"`）信任级别等同公开 API 端点：

```tsx
'use server'
import { z } from 'zod'

const Input = z.object({ email: z.string().email(), age: z.number().int().min(0).max(120) })

export async function updateUser(_state: unknown, formData: FormData) {
  const parsed = Input.safeParse({ email: formData.get('email'), age: Number(formData.get('age')) })
  if (!parsed.success) return { error: parsed.error.flatten() }
  // 在 action 内认证 + 授权，不信任客户端路由门
}
```

- 在 action 内**认证**，不信任客户端路由 gate。
- **授权**：确认当前用户对要改的具体记录有权限。
- 敏感 action 限流。

## 5. Auth State

- 会话**绝不**存 `localStorage`（任何 XSS 可读）——用 httpOnly + Secure cookie。
- JSX 渲染门只挡显示、不挡访问——**API 必须强制鉴权**。
- cookie 鉴权配 CSRF token 或 `SameSite=Strict/Lax`。

## 6. CSP & Prototype Pollution

- 服务端配 CSP：避免 `script-src` 的 `unsafe-inline` / `unsafe-eval`，SSR 内联脚本用 per-request nonce。
- 不可信 JSON 不直接 spread 进 state（`__proto__` 污染）——先用 schema（zod）解析再用，见 [ts-security.md](../typescript/ts-security.md)。

## 7. Third-Party & Build

- 加 UI 库前 `npm audit`；警惕内部对输入用 `dangerouslySetInnerHTML` 的富文本组件。
- 生产构建不发布 source map（或上传至错误追踪后从公开 bundle 剥离）。

## 8. Checklist

- [ ] 每处 `dangerouslySetInnerHTML` 已审查并就近净化（白名单）。
- [ ] 外链 URL 校验 scheme；`target="_blank"` 配 `rel="noopener noreferrer"`。
- [ ] 服务端密钥不带公开前缀，不泄进 bundle。
- [ ] Server Action 内认证 + 授权 + 校验输入 + 限流。
- [ ] 会话用 httpOnly cookie，不存 localStorage；API 强制鉴权。
- [ ] 配 CSP；不可信 JSON 经 schema 解析再用。
