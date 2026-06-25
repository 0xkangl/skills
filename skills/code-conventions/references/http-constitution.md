# HTTP Constitution v1.0

> Applies to: All HTTP services / microservices / external APIs | Goal: Standardize API design for consistency, maintainability, performance, and observability

## 1. Design Principles

- **Consistency**: Follow unified structure and naming conventions
- **Semantic clarity**: Use HTTP methods and status codes correctly
- **Observability**: Every request must be traceable via `X-Request-Id` (see §7.1)
- **Security**: Never expose internal implementation details
- **Backward compatibility**: Breaking changes are not allowed

## 2. HTTP Fundamentals

**Method Semantics (mandatory):**

| Method | Semantics | Idempotent |
|--------|-----------|------------|
| GET | Retrieve | Yes |
| POST | Create / Action | No |
| PUT | Full / Partial update | Conditional |
| DELETE | Delete | Yes |

**Prohibited:** `POST /getUser`, `POST /updateUser`, `POST /deleteUser`

**Status Codes:** Success 200/201/204; Client errors 400/401/403/404/409; Server errors 500/503

**Content-Type:** `application/json; charset=utf-8`

## 3. Request Convention

### 3.1 Request Body

- Request bodies must contain only business data — no extra wrappers (e.g., `{"data": {}}`)
- PUT = full replacement / partial update
- Omitting a field = no change; `null` = clear the value

### 3.2 Field Naming

- camelCase is mandatory at the API layer (`userName` yes; `user_name` no)
- Mixed naming styles are prohibited

### 3.3 Time Format (mandatory)

- **API**: ISO 8601 ending with `Z`, milliseconds recommended (`2026-03-30T20:00:00.123Z`)
- **Request body**: Same ISO 8601 format required (`"startAt": "2026-03-30T20:00:00Z"`)
- **Field naming**: createdAt (creation) | updatedAt (update) | deletedAt (soft delete)

Prohibited: `"2026-03-30 12:00:00"` | `"03/30/2026"` | `1711800000` (timestamps prohibited by default)

## 4. Response Structure

### 4.1 Success

```json
{ "code": 0, "message": "ok", "data": {} }
```

### 4.2 Error

```json
{ "code": 1001, "message": "parameter error", "details": "email invalid" }
```

### 4.3 Error Code Ranges

| Range | Category | HTTP Status Range |
|-------|----------|-------------------|
| 1000–1999 | Parameter | 400 |
| 2000–2999 | Authentication | 401, 403, 409, 429 |
| 3000–3999 | Authorization | 403 |
| 4000–4999 | Business | 400, 403, 404, 409 |
| 5000+ | System | 500 |

See [error-codes.md](./error-codes.md) for the full registry.

### 4.4 Compatibility Principles

- Add fields: allowed
- Remove fields: prohibited
- Change types: prohibited

## 5. Pagination

### 5.1 Offset (default)

`GET /resources?page=1&pageSize=20`

```json
{ "code": 0, "data": { "list": [], "pagination": { "page": 1, "pageSize": 20, "total": 100, "hasMore": true } } }
```

**Sorting:** `GET /resources?sortBy=createdAt&order=desc`

**Rules:** `page` starts at 1, `pageSize` <= 100, `hasMore` is required. Sorting is optional — the server MAY use a fixed sort order instead of accepting client-specified `sortBy`/`order`.

### 5.2 Cursor (high-performance)

`GET /resources?cursor=xxx&limit=20`

```json
{ "code": 0, "data": { "list": [], "nextCursor": "xxx", "hasMore": true } }
```

### 5.3 Rules

- **Stable sort required:** `ORDER BY created_at DESC, id DESC`
- **Prohibited:** No pagination structure, paginated results without sorting, unbounded pageSize

## 6. Database Convention

- **Naming:** snake_case (e.g., `users`, `created_at`, `order_items`)
- **Primary key:** `id` (auto-increment or snowflake ID); Timestamps: `created_at`, `updated_at`
- **Offset pagination:** `LIMIT :pageSize OFFSET (:page-1)*:pageSize`; Cursor (recommended): `WHERE id < :last_id ORDER BY id DESC LIMIT :limit`
- Pagination and sort columns must be indexed
- **Prohibited:** Deep pagination (large offset), sorting without indexes

### Database Time Storage

Core principle: Database storage must always represent a UTC point in time.

**PostgreSQL (mandatory):**

```sql
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
```

`TIMESTAMP WITHOUT TIME ZONE` is prohibited.

**MySQL (mandatory):**

```sql
created_at DATETIME(3) NOT NULL
updated_at DATETIME(3) NOT NULL
```

- Application layer uses `time.Now().UTC()`, database connection sets `SET TIMEZONE 'UTC'`
- `TIMESTAMP` type is not recommended (inconsistent automatic timezone conversion, range limited to 1970–2038, many implicit behaviors)

| Feature | PostgreSQL | MySQL |
|---------|-----------|-------|
| Recommended type | timestamptz | DATETIME(3) |
| Stores UTC | Yes | Yes (application-enforced) |
| Automatic timezone conversion | Yes | Conditional (only for TIMESTAMP) |

### End-to-End Time Flow

Database (UTC session) -> Backend (`time.Now().UTC()`) -> API (ISO 8601 Z) -> Frontend (use as-is)

### Special Cases (exceptions allowed)

- Pure local-time business logic (business hours / calendars): `TIME` type is acceptable
- High-performance internal APIs: Millisecond timestamps `1711800000000` are acceptable with documented justification

### Time Prohibited

- Storing local time (e.g., `2026-03-30 12:00:00`)
- Returning times without timezone offset in API responses (e.g., `2026-03-30T12:00:00` without offset)
- Mixing time formats

## 7. Headers

### 7.1 Correlation Header

```
X-Request-Id: <uuid>
```

- **Client responsibility**: If the client sends `X-Request-Id`, the server MUST accept and propagate it. If the client does not send one, the server (or edge gateway) MUST generate one.
- **Propagation**: The server MUST include `X-Request-Id` in every response header and forward it to all downstream service calls. This is the single correlation ID used across all modules.
- **Log field**: Map to the `traceId` field in structured logs (see [Observability Convention](observability.md) §5).
- **Distributed tracing**: When a tracing backend (OpenTelemetry, Jaeger, etc.) is later adopted, the W3C `traceparent` header is added alongside `X-Request-Id`. They serve different purposes — `X-Request-Id` for request correlation, `traceparent` for span-based tracing.

### 7.2 Auth Header

```text
Authorization: Bearer <token>
```

### 7.3 Client Request Headers (required for all /v1/ endpoints)

| Header | Required | Description | Valid Values | Example |
|--------|----------|-------------|--------------|---------|
| X-Client-Platform | Yes | Client platform | ios, android, web | ios |
| X-Client-Version | Yes | App version, semantic versioning X.Y.Z | `^\d+\.\d+\.\d+$` | 1.2.0 |

Missing or invalid headers return HTTP 400 with error code 1001. Non-`/v1/` paths (e.g., `/health`, `/metrics`, `/webhooks`) are exempt from validation.

### 7.4 Content Negotiation — Language (`Accept-Language`)

Use the **standard** `Accept-Language` header for locale negotiation — do NOT invent a custom `X-Client-Language` header.

```
Accept-Language: zh-Hans,zh;q=0.9,en;q=0.8
```

- **Optional**: A missing or unparseable `Accept-Language` is NOT a 400. The server falls back to its configured default locale (e.g. `en`). Only `/v1/` business headers in §7.3 are mandatory.
- **Value format**: BCP 47 language tags / quality-ranked list (RFC 9110 §12.5.4). The server resolves the best match against its **supported locale set**.

**Locale model — prefer content locale (script), not region:**

- The supported set MUST be expressed as **content locales using script subtags** (`zh-Hans`, `zh-Hant`, `en`), because written-language variants (Simplified vs Traditional Chinese) are a *script* distinction, not a *country* one. Region tags (`zh-CN`, `zh-TW`) over-specify and fragment translations.
- Incoming region tags MUST be normalized to a content locale before matching:

| Incoming (region / legacy) | Normalized content locale |
|----------------------------|---------------------------|
| `zh-CN`, `zh-SG`, `zh-Hans-*` | `zh-Hans` |
| `zh-TW`, `zh-HK`, `zh-MO`, `zh-Hant-*` | `zh-Hant` |
| `zh` (no script/region) | default Chinese script (`zh-Hans`) |
| `en-US`, `en-GB`, `en-*` | `en` |
| unsupported / unmatched | configured default locale |

- The resolved locale is what drives i18n responses and is logged as a context field where relevant. Default locale and supported set are configuration — see [configuration.md](./configuration.md).

## 8. Idempotency

> Prevent duplicate write operations caused by network retries (duplicate orders, duplicate customer creation, etc.).

### Header

```
Idempotency-Key: <uuid>
```

- Opt-in: Activated only when the client sends an `Idempotency-Key` header. Requests without it follow the normal flow.
- Key format: **Any valid UUID** (v7 recommended, lowercase, with hyphens). Invalid format returns `400` + code `4091`.

### Behavior

| Scenario | Behavior |
|----------|----------|
| First request (key not found) | Execute handler; on success (2xx) store the response; on failure delete the key |
| Duplicate request (key already completed) | Return the stored original response (status + headers + body) with an additional `X-Idempotent-Replayed: true` header |
| Concurrent request (key pending) | Return `409 Conflict` + code `4090` |
| Same key + different request body | Return `409 Conflict` + code `4090` (prevents key misuse) |
| Retry after a failed request | Original key has been deleted; the same key can be reused for a new attempt |

### Scope

- The middleware is mounted on the `/v1` route group and applies to all write endpoints.
- It only activates for requests carrying the `Idempotency-Key` header. GET/HEAD requests are unaffected but not blocked.

## 9. Observability

- **Structured logging**: Application-level logging at logic positions (levels, fields, where to log) is defined in [Observability Convention](observability.md).
- **Correlation**: `X-Request-Id` propagation across all services (see §7.1).
- **Metrics**: Required for HTTP services (QPS, latency, error rate).

**Metrics endpoint (`GET /metrics`):** Controlled by `METRICS_PORT`. When `0`, register `/metrics` on the main HTTP server (`PORT`). When non-zero (e.g. `9090`), serve `/metrics` on a dedicated listener at that port. In both modes, `/metrics` is outside the `/v1` prefix and exempt from client header validation.

## 10. API Versioning

`/v1/users`

## 11. Security

Enforce HTTPS | Input validation | Never return sensitive data | Prevent SQL injection / XSS

## 12. Prohibited Patterns

- Mixed naming styles
- Misuse of POST
- Non-standard response structures
- Missing `X-Request-Id` propagation
- Unpaginated list endpoints

## 13. Pre-Launch Checklist

- [ ] Standard HTTP methods
- [ ] Unified response structure
- [ ] camelCase field names
- [ ] Pagination convention
- [ ] snake_case database naming
- [ ] Time format compliance (ISO 8601 + UTC)
- [ ] `X-Request-Id` propagation
- [ ] Logging and monitoring
- [ ] Complete input validation

## 14. Summary

**Unified structure + correct semantics + stable pagination + observability = production-grade API**

This convention is an organization-wide mandatory standard. All new services must comply; existing systems migrate incrementally.
