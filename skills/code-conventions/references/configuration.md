# Configuration Convention v1.0

> Applies to: All modules (server, web, client, dev tools) | Goal: Standardize how runtime configuration and secrets are named, namespaced, derived, and stubbed — so the same config reads consistently across projects and modules, and never collides or leaks.

For the full convention index, see [../SKILL.md](../SKILL.md).

## 1. Design Principles

- **Config from environment**: All runtime config comes from environment variables (12-factor). No environment-specific values hard-coded in source.
- **Secrets never in repo**: Keys, tokens, and passwords live in the environment / a secret manager — never committed. `.env.example` ships the *names* with placeholder values only.
- **Fail-fast**: Required config missing at startup is a fatal error, not a lazy default. Log the missing key name (never its value) and exit non-zero.
- **Explicit over magic**: Every config key has a single documented name, type, and default. Optional keys state their default; required keys state that they are required.

## 2. Naming

- Environment variable names use `UPPER_SNAKE_CASE` (`DATABASE_URL`, `METRICS_PORT`, `AUTH_ACCESS_TOKEN_TTL`).
- Group related keys by a common noun prefix (`JWT_*`, `REDIS_*`, `SMTP_*`).
- Booleans are `true` / `false`; durations are Go-style strings (`15m`, `24h`) or explicit `_SECONDS` integers — pick one style per project and keep it consistent.
- Every key MUST appear in `.env.example` with a comment noting required/optional and the default.
- **Keep `.env.example` in sync**: whenever a variable is added, renamed, or removed, update `.env.example` in the **same change** — code and template must never drift. When adding one, place it in the correct group and importance order per the §3 reference (and update §3 if the key is a new convention-level variable, not project-specific).

## 3. Environment Variable Reference

The canonical variable set, grouped and ordered by boot-criticality (a service must resolve earlier groups before it can serve traffic). This table is the source of truth for `.env.example` — an annotated, copy-ready template lives at [`.env.example`](.env.example). Project-specific keys extend it but follow the same column discipline.

**Required legend:** **Yes** = startup fails without it · **No** = has a safe default · **Cond.** = required only when the related feature is enabled (cache, queue, internal endpoints, real third-party calls).

### 3.1 Core Runtime

| Key | Required | Default | Valid / Recommended | Notes |
|-----|----------|---------|---------------------|-------|
| `APP_ENV` | Yes | — | `development` \| `staging` \| `production` | Selects env-specific behavior; `production` hardens defaults |
| `PORT` | Yes | service-defined | e.g. `8080` | Main HTTP listener |
| `LOG_FORMAT` | No | `json` | `json` \| `text` | `text` only for local dev (see [observability.md](./observability.md) §2.1) |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` | Enable `debug` here only — never hard-code (observability §3) |
| `METRICS_PORT` | No | `9090` | `9090` (dedicated) \| `0` (main server) | See §9 |

### 3.2 Data Store

| Key | Required | Default | Valid / Recommended | Notes |
|-----|----------|---------|---------------------|-------|
| `DATABASE_URL` | Yes | — | `postgres://user:pass@host:5432/db?sslmode=disable` | `sslmode=require` in production; format required by golang-migrate ([go-tools.md](golang/go-tools.md) §2.3) |

### 3.3 Security & Secrets

| Key | Required | Default | Valid / Recommended | Notes |
|-----|----------|---------|---------------------|-------|
| `APP_PEPPER` | Yes | — | 64 hex chars (256-bit) | Generate: `openssl rand -hex 32`. General-purpose secret for **transient** business uses; HKDF-derive per purpose (§6.1). Short rotation cadence. Never logged |
| `JWT_SIGNING_KEY` | Yes | — | 64 hex chars (256-bit) | Generate: `openssl rand -hex 32`. **Dedicated**, independently maintained — NOT derived from `APP_PEPPER` (§6.2 / §7) |
| `<PURPOSE>_ENCRYPTION_KEY` | Cond. | — | 64 hex chars (256-bit) | Required for data encrypted **at rest** in the DB. **Dedicated** + long-lived; rotate only via a re-encryption migration (§6.2) |
| `<MODULE>_INTERNAL_TOKEN` | Cond. | — | 64 hex chars | Required if the module exposes internal endpoints. Generate: `openssl rand -hex 32`. See §5 |
| `AUTH_ACCESS_TOKEN_TTL` | No | `15m` | duration string | Mobile/native + default access token (§7) |
| `AUTH_REFRESH_TOKEN_TTL` | No | `30d` | duration string | Mobile/native + default refresh token |
| `AUTH_WEB_ACCESS_TOKEN_TTL` | No | `15m` | duration string | Web access token; falls back to `AUTH_ACCESS_TOKEN_TTL` if unset |
| `AUTH_WEB_REFRESH_TOKEN_TTL` | No | `24h` | duration string | Web refresh token; falls back to `AUTH_REFRESH_TOKEN_TTL` if unset |

### 3.4 Cache / Queue

| Key | Required | Default | Valid / Recommended | Notes |
|-----|----------|---------|---------------------|-------|
| `REDIS_URL` | Cond. | — | `redis://host:6379/0` | Required if cache / session / rate-limit is used |
| `CACHE_KEY_PREFIX` | Cond. | `""` (empty) | project slug, e.g. `acme` | Empty OK for local single-tenant; MUST be set on shared/prod infra (§4) |
| `QUEUE_NAME_PREFIX` | Cond. | `""` (empty) | project slug, e.g. `acme` | Required when a shared broker is used (§4) |

### 3.5 Localization

| Key | Required | Default | Valid / Recommended | Notes |
|-----|----------|---------|---------------------|-------|
| `DEFAULT_LOCALE` | Yes | — | BCP 47 content locale, e.g. `en`, `zh-Hans` | Fallback when `Accept-Language` is absent/unmatched; any valid BCP 47 tag (not required to be `en`) ([http-constitution.md](./http-constitution.md) §7.4) |

### 3.6 Third-Party Integrations

| Key | Required | Default | Valid / Recommended | Notes |
|-----|----------|---------|---------------------|-------|
| `<PROVIDER>_PROVIDER` | No | `stub` | `stub` \| `<real impl>` (e.g. `twilio`) | Selects the adapter implementation; `stub` is one of them (§8). Set a real impl in staging/prod |
| `<PROVIDER>_API_KEY` / creds | Cond. | — | from provider | Required when a real impl is selected. Never commit; never log |

## 4. Namespacing Shared Infrastructure (cache / queue / pub-sub)

When multiple projects — or multiple modules of one project — share a Redis instance, a queue broker, or a key-value store, keys MUST be namespaced to prevent cross-contamination.

**Key format:** `{projectPrefix}:{modulePrefix}:{logicalKey}`

| Segment | Source | Mutable? | Rationale |
|---------|--------|----------|-----------|
| `projectPrefix` | Config (`CACHE_KEY_PREFIX` / `QUEUE_NAME_PREFIX`) | Yes — set per deployment | Same module deployed for different tenants/projects must not collide on shared infra |
| `modulePrefix` | **Fixed constant in code** | No | A module owns its namespace; it is an identity, not an operational knob, so it is not configurable |
| `logicalKey` | Code | — | The actual business key (`otp:<email>`, `session:<id>`) |

```
# cache key   (Redis):  acme:auth:otp:user@example.com
# queue topic (Kafka):  acme.auth.user-registered     # use '.' where the broker convention prefers it
```

**Rules:**

- `projectPrefix` is read from config (e.g. `CACHE_KEY_PREFIX=acme`); default MAY be empty for single-tenant local dev but MUST be set in shared/production environments.
- `modulePrefix` is a compile-time constant in the module (e.g. `const cacheNS = "auth"`), never read from env — it is fixed so a module cannot accidentally read/write another module's keys.
- Queue/topic names follow the same two-prefix rule, using the separator the broker idiomatically expects.

## 5. Inter-Module Authentication

Module-to-module (internal, non-public) calls MUST be authenticated with a shared token, not left open on the trust of network placement.

- Each module that exposes internal endpoints defines `<MODULE>_INTERNAL_TOKEN` (e.g. `BILLING_INTERNAL_TOKEN`).
- Callers attach it on internal requests; the receiving module validates it before processing and rejects mismatches with the auth error code (see [error-codes.md](./error-codes.md), 2xxx range).
- Carried in a dedicated `X-Internal-Token` header so it is never confused with end-user JWTs in the `Authorization` header:

  ```
  X-Internal-Token: <token>
  ```

- Tokens are generated as random secrets (see §6), rotated per environment, and never logged.
- This guards the internal surface only; end-user auth still uses Bearer JWT (§7). Internal endpoints live under the `/internal/v1` prefix — separate from the public `/api/v1` surface (see [http-constitution.md](./http-constitution.md) §10) — and are not exposed externally.

## 6. Secrets & Cryptographic Keys

Choose the key strategy by **what the secret protects and how long that artifact lives** — rotating a key invalidates everything still derived from or signed by it, so persisted/long-lived data needs keys that are rotated rarely and independently.

### 6.1 General-purpose master secret (`APP_PEPPER`)

For **transient, business-layer** uses where nothing long-lived is stored under the key — peppering one-time codes, short-lived opaque tokens, cache-bound values.

- One application-wide master secret, `APP_PEPPER`.
- **Never reuse it directly** for multiple purposes — derive a per-purpose subkey via **HKDF** with a distinct, stable `info` label:

  ```
  key_otp       = HKDF(APP_PEPPER, info="otp-pepper")
  key_emailtok  = HKDF(APP_PEPPER, info="email-verification-token")
  ```

  Distinct `info` labels give cryptographic separation: compromising one derived use does not expose the others.
- **Rotatable on a relatively short cadence** — safe precisely because only transient artifacts depend on it; rotation invalidates in-flight codes/tokens, which is acceptable.

### 6.2 Dedicated, independently-maintained keys

For anything **persisted to the database or otherwise long-lived** — field-level encryption at rest, long-lived tokens, JWT signing.

- Each gets its **own env var** (`JWT_SIGNING_KEY`, `<PURPOSE>_ENCRYPTION_KEY`), **NOT** derived from `APP_PEPPER`. Deriving an at-rest/long-lived secret from a frequently-rotated master would make stored data undecryptable (or all sessions invalid) after a routine pepper rotation.
- Maintained and rotated **independently and rarely**, and only with a migration plan — re-encrypt stored data, or support old+new key during an overlap window (e.g. a JWT `kid` header selecting the signing key).
- Generated the same way (`openssl rand -hex 32`) but managed as long-term secrets in the secret manager.

### 6.3 Common rules

- **Generation**: 256-bit secrets via `openssl rand -hex 32`.
- **Handling**: loaded from env at startup, kept in memory, and MUST NOT be logged, returned in any API response, or written to disk. See [observability.md](./observability.md) §6 (Prohibited Content).

## 7. Auth / JWT TTLs

- Token lifetimes are config, not hard-coded: `AUTH_ACCESS_TOKEN_TTL`, `AUTH_REFRESH_TOKEN_TTL`.
- **Web services use shorter TTLs** — for *both* access and refresh tokens — than long-lived clients (mobile/native), because browser sessions are higher-risk (XSS, shared machines) and re-login is cheap. Provide web-specific overrides:

  | Key | Typical | Applies to |
  |-----|---------|------------|
  | `AUTH_ACCESS_TOKEN_TTL` | minutes (e.g. `15m`) | Mobile / native / default access token |
  | `AUTH_REFRESH_TOKEN_TTL` | days–weeks | Mobile / native / default refresh token |
  | `AUTH_WEB_ACCESS_TOKEN_TTL` | minutes (e.g. `15m`) | Web frontend access token |
  | `AUTH_WEB_REFRESH_TOKEN_TTL` | `24h` (default) | Web frontend refresh token |

- The web-specific TTLs are selected by platform (`X-Client-Platform: web`, see [http-constitution.md](./http-constitution.md) §7.3). When a web override is unset, fall back to the corresponding default key. Tokens are signed with the dedicated `JWT_SIGNING_KEY` (§6.2), not derived from `APP_PEPPER`.

## 8. Third-Party Integrations — Provider Selection

Every external integration (SMS, email, payment, object storage, etc.) sits behind an interface with **multiple interchangeable provider implementations**. The active one is chosen by config — `stub` is just one of the providers, not a separate boolean flag.

- Select per integration via `<PROVIDER>_PROVIDER` (e.g. `SMS_PROVIDER=twilio`, `SMS_PROVIDER=stub`).
- The `stub` provider does NOT call any external service. It:
  - returns a deterministic success (or a configurable canned response),
  - **logs the call it would have made** at `info` (target, operation, sanitized params — never secrets), so the developer can verify the flow,
  - implements the same interface as the real providers, so calling code is unaware of the choice.
- Each real provider reads its own creds (`<PROVIDER>_API_KEY`, …), validated only when that provider is selected.
- Default `stub` for local dev/test; staging and production MUST select a real provider — treat `<PROVIDER>_PROVIDER=stub` under `APP_ENV=production` as a startup error.
- This complements, not replaces, interface-based mocks in tests — see the `testing` convention. The `stub` provider runs the app locally; mocks assert behavior in tests.

## 9. Service Ports

| Key | Default | Behavior |
|-----|---------|----------|
| `PORT` | service-defined | Main HTTP listener |
| `METRICS_PORT` | `9090` | non-zero (default `9090`) → dedicated listener on that port; `0` → expose `/metrics` on the main `PORT` |

Full `/metrics` semantics are defined in [http-constitution.md](./http-constitution.md) §9 and [observability.md](./observability.md) §8.

## 10. Go Binding

Go services bind and validate all of the above in `internal/config/config.go` (see [golang/go-project.md](golang/go-project.md)): load env → validate required keys (fail-fast) → expose a typed `Config` struct. `modulePrefix` constants and HKDF `info` labels live in the owning package, not in config. Secrets are read once into the struct and passed via dependency injection.

## 11. Checklist

- [ ] `.env.example` updated in the same change for every added/renamed/removed key, placed in the correct group + importance order (§2, §3); required/optional + default noted; no secret values committed
- [ ] Required keys fail-fast at startup (logged by name, never value)
- [ ] Cache/queue keys carry `projectPrefix` (config) + `modulePrefix` (fixed in code)
- [ ] Internal endpoints validate `<MODULE>_INTERNAL_TOKEN`
- [ ] Transient secrets HKDF-derived from `APP_PEPPER` (distinct `info`); DB-stored/long-lived keys (`JWT_SIGNING_KEY`, `*_ENCRYPTION_KEY`) are dedicated, NOT derived; all via `openssl rand -hex 32`; never logged
- [ ] JWT signed with dedicated `JWT_SIGNING_KEY`; TTLs are config; web has shorter `AUTH_WEB_ACCESS_TOKEN_TTL` and `AUTH_WEB_REFRESH_TOKEN_TTL` (default `24h`)
- [ ] Each third-party integration selects its impl via `<PROVIDER>_PROVIDER`; `stub` logs intended calls; `APP_ENV=production` rejects `stub`
