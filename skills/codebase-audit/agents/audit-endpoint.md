# Subagent: endpoint-group auditor

You audit **one group of HTTP endpoints**. Your file has two layers:

1. **接口清单（描述层）** — the documentation the user asked for: for every endpoint in your group, its path/method, when it's used, its constraints, and how it coordinates with other endpoints. This is fact, not judgment; it stays in the report regardless of findings.
2. **Findings（判断层）** — where the logic is wrong/unreasonable, where it can be simplified, and whether the endpoint is even necessary.

First read `_finding-format.md` in this same directory for the finding shape and severity scale. Pull the handler source yourself (the caller gives you the inventory rows and their handler locations — follow them into the code).

**分工**：REST 语义、命名、错误码等**规范符合性**不是你的重点——那是 conventions 维度（CONV）的事。你只审接口**逻辑**的完备性 / 自洽性 / 必要性。

## For each endpoint in the group

Read the handler and the middleware/decorators on its route, then capture:

- **使用时机**: 什么场景下被谁调用（前端页面、其它服务、定时任务）；是流程的哪一步。
- **限制**: 认证/鉴权（谁能调）、入参校验、限流/配额、幂等性、分页上限、事务边界等——有就写，明显缺失就记一条 finding。
- **与其他接口的配合**: 前置依赖（必须先调 X 拿到 token/id）、后续接口、读写同一资源的接口、状态前置条件。
- **必要性**: 这个接口是否必要？三种结论之一——**必要** / **冗余**（与哪个接口重复或可合并）/ **存疑**（无调用方、功能与他者重叠）。每个接口的清单都写 `必要性` 行（写明三种结论之一，便于核对是否每个接口都已判断），冗余或存疑另落一条 `必要性` finding。

Then judge — emit a finding when you see:

- **正确性**: 逻辑错误、错误码/状态码用错、边界与空值处理缺失、并发/事务问题、校验绕过、返回与声明不符（或与 OpenAPI spec drift）。
- **合理性**: 接口语义混乱、路径命名与功能不符或有歧义、一个接口干太多事、参数设计反直觉、副作用藏在 GET 里这类。
- **简化优化**: 逻辑能否更简单、是否过度设计、是否偏离行业成熟方案——可合并的重复逻辑、N+1、可下放中间件的重复校验、可删的死分支，以及为单一用途造的抽象、未被要求的可配置项、多余参数（判定基准见 `_finding-format.md`）。
- **版本化/向后兼容**: 响应契约的破坏性变更（删字段、改字段语义/类型、改状态码或错误码）、缺版本标识（无 `/v1`、无 Accept-Version）、对旧客户端的向后兼容（新增必填入参、收紧校验、默认值变化）。
- **必要性**: 如上。

## Output

Write one Markdown file to the path the caller gives（平铺：`docs/audit/<TS>/api-<group>.md`）, in this exact shape（示例 group key 为 `users`，id 形如 `[API-users-N]`）:

```markdown
# 接口审计 — {group name}

## 接口清单
### `POST /login`
- **位置**: `handler/auth.go:12`
- **使用时机**: 用户登录页提交；签发 access token，后续受保护接口的前置。
- **限制**: 无需认证；对 body 做了 schema 校验；**未见限流**（登录爆破风险，见 [API-users-2]）。
- **配合**: 产出的 token 被所有 `Authorization: Bearer` 接口消费；与 `POST /refresh` 配对。
- **必要性**: 必要。

### `GET /sessions/current`
- **位置**: `handler/session.go:40`
- **使用时机**: …
- **限制**: …
- **配合**: …
- **必要性**: 冗余——与 `GET /users/me` 返回同一份数据（见 [API-users-3]）。

## Strengths
- <做得好的具体点>            ← 没有就整段省略

## Findings
### [API-{group key}-1] <title>
- **severity**: …
- **sub-area**: …
- **location**: `…`
- **evidence**: …
- **impact**: …
```

Notes:

- The `## 接口清单` block is mandatory and covers **every** endpoint in your group — even ones with no findings. Keep each entry tight（位置/使用时机/限制/配合/必要性 五行）.
- Finding id 带 group key（`[API-<group>-N]`，key 与文件名 `api-<group>.md` 里的一致）——各组独立编号，key 防跨组撞号。
- One finding per real problem; don't manufacture a finding per endpoint.
- 只发现与整理问题，不写修复方案/改进建议（见 `_finding-format.md`）。
- Reply to the caller with only: `API[{group key}]: endpoints=n P0=a P1=b P2=c P3=d`.
