# Observability Convention v1.0

> Applies to: All modules (server, web, client, dev tools) | Goal: Standardize logging, tracing, and diagnostic output so logic flows are analyzable and incidents are locatable

For the full convention index, see [../SKILL.md](../SKILL.md).

## 目录

- [1. Design Principles](#1-design-principles)
- [2. Log Format](#2-log-format)
- [3. Log Levels](#3-log-levels)
- [4. Logic Positions](#4-logic-positions)
- [5. Correlation (traceId)](#5-correlation-traceid)
- [6. Data Protection](#6-data-protection)
- [7. CLI and Batch Tool Logging](#7-cli-and-batch-tool-logging)
- [8. Client-Specific Notes](#8-client-specific-notes)
- [9. Metrics and Distributed Tracing](#9-metrics-and-distributed-tracing)
- [10. Implementation Checklist](#10-implementation-checklist)
- [11. Summary](#11-summary)

## 1. Design Principles

- **Structured over free text**: Logs must be machine-parseable (JSON or key-value text), not ad-hoc `printf` strings.
- **Traceable**: Every log line in a request/workflow path must carry a correlation ID (`traceId`).
- **Actionable**: Logs exist to answer *what happened, where, and why* — not to narrate every line of code.
- **Safe**: Never log secrets, credentials, tokens, or full PII.
- **Consistent**: Field names and levels are uniform across modules so operators can search across services.

HTTP-specific observability (header `X-Request-Id`, `/metrics` endpoint) is defined in [HTTP Constitution](http-constitution.md) §7 and §9. This document covers **application-level logging at logic positions**.

## 2. Log Format

### 2.1 Format Selection

Logs MUST be machine-parseable. Two formats are supported:

| Format | When to use | Configuration |
|--------|-------------|---------------|
| JSON | Production, aggregators (ELK, Datadog, CloudWatch) | `LOG_FORMAT=json` (default) |
| Text | Local development, `stdout` inspection | `LOG_FORMAT=text` |

### 2.2 Base Fields

Every log entry MUST include these fields:

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `timestamp` | Yes | ISO 8601 UTC with milliseconds | `2026-06-06T08:30:00.123Z` |
| `level` | Yes | Log severity (see §3) | `info` |
| `message` | Yes | Short human-readable summary of the event | `payment: authorized` |
| `traceId` | Yes* | Request/workflow correlation ID | `a1b2c3d4-...` |
| `module` | Yes | Originating workspace module name | `user-service`, `api-gateway` |
| `component` | Yes | Package, layer, or file area (lowercase with underscores) | `payment_service`, `api_client` |
| `operation` | Recommended | Function or business action name (lowercase) | `authorize_payment`, `create_order` |

*Client offline logs may defer `traceId` until sync; must attach one before upload.

**Naming rules:**

- All **field names** use camelCase (`traceId`, `elapsedMs`, `orderId`).
- `component` and `operation` values use lowercase with underscores (e.g., `payment_service`, `authorize_payment`); normalize a package path such as `api/client` to `api_client`.
- `module` MUST preserve the actual module/repo name, including its existing hyphens (e.g., `user-service`, `api-gateway`), NOT the template name (e.g., not `server`). Do not rename a module merely to fit a log-field style.
- `message` uses a lowercase `domain: event` prefix — `location: geocode ok`, `cache: get`, `prayer: official missing, fallback to calculated`. Keep it a stable literal; variables belong in fields, not interpolated into the message.

### 2.3 Context Fields

Additional context fields (add as needed):

| Field | When to include |
|-------|-----------------|
| `userId` | When the action is user-scoped (never log email/phone as identifier) |
| `entityId` | When acting on a domain entity (`orderId`, `sessionId`) |
| `elapsedMs` | Elapsed wall-clock after completing an operation, an external call, or a whole CLI command / batch run |
| `done` / `total` | Progress counters on long-running batch work (see §7.3) |
| `errorCode` | On business or system errors (align with [error-codes.md](./error-codes.md)) |
| `outcome` | `success` / `failure` / `skipped` for branch decisions |

### 2.4 Format Examples

**JSON format** (`LOG_FORMAT=json`):

```json
{
  "timestamp": "2026-06-06T08:30:00.123Z",
  "level": "info",
  "message": "payment: authorized",
  "traceId": "7f3e2a1b-9c8d-4e5f-a6b7-c8d9e0f1a2b3",
  "module": "user-service",
  "component": "payment_service",
  "operation": "authorize_payment",
  "orderId": "ord_123",
  "elapsedMs": 142,
  "outcome": "success"
}
```

**Text format** (`LOG_FORMAT=text`):

```text
2026-06-06T08:30:00.123Z info payment: authorized traceId=7f3e2a1b-9c8d-4e5f-a6b7-c8d9e0f1a2b3 module=user-service component=payment_service operation=authorize_payment orderId=ord_123 elapsedMs=142 outcome=success
```

### 2.5 Output

| Process type | Destination | Why |
|-------------|-------------|-----|
| Long-running service (HTTP server, worker, consumer) | **stdout** | The runtime (Docker, systemd, Kubernetes) routes stdout to the appropriate sink |
| CLI / batch tool | **stderr** | stdout is reserved for the command's own output (see §7.5) |

Module configs MAY override the destination for specific environments, but the table above is the baseline.

## 3. Log Levels

| Level | Use when | Examples |
|-------|----------|----------|
| `error` | Operation failed; requires attention or retry | DB connection lost, unhandled exception, external API 5xx |
| `warn` | Degraded but recoverable: an upstream/infrastructure failure that was absorbed (fallback taken, error swallowed), or a business rule rejection | Retry attempt, rate limit hit, provider returned non-2xx and fallback was used, cache read failed and was treated as a miss, validation rejected by rule |
| `info` | Significant business events and state transitions | Entity created/updated, workflow step completed, auth success |
| `debug` | Diagnostic detail for development/troubleshooting | Branch taken, cache hit/miss, computed intermediate values |

**Choosing between `info` and `debug` — one line:**

> Classify failures as `warn` or `error` using the table first. For remaining events, a successful third-party network call or a change in response semantics (mode switch, fallback without an upstream failure, a learned/derived value that alters the answer) → `info`. In-process flow detail → `debug`.

**Infrastructure boundary:** self-owned infrastructure (your own database, cache, queue) is *not* a third-party upstream. Routine access logs at `debug`; failures log at `warn` when absorbed, `error` when propagated.

**Rules:**

- Production default: `info`. Enable `debug` only via environment/config, never hard-coded.
- The level is fixed at process start via `LOG_LEVEL`. To troubleshoot production, set `LOG_LEVEL=debug`, restart, and set it back when done. Do **not** build runtime dynamic level switching.
- One `error` per failure path — log at the point you handle or propagate the error, not at every wrapper.
- Do not use `info` for high-frequency loops (per-row, per-tick). Aggregate or use `debug`.

## 4. Logic Positions

Log at **decision points** and **boundaries**, not on every statement.

### 4.1 Entry and Exit (Boundaries)

| Position | Level | What to log |
|----------|-------|-------------|
| HTTP handler / API route entry | `info` | Method, path (or operation name), key input IDs, sanitized path/query parameters and bounded JSON `requestBody` (§6.3); auth-header presence when token auth is used |
| HTTP handler exit | `info` | Method, path (or operation name), HTTP `statusCode`, outcome, `elapsedMs` |
| HTTP response result | `debug` | Sanitized, bounded JSON `responseBody` (§6.3), including error results |
| Background job / cron start & end | `info` | Job name, batch size, `elapsedMs`, outcome |
| Message consumer receive & ack/nack | `info` | Topic/queue, message ID, outcome |

**Backend request logging is required.** Use shared middleware / hooks to record entry and completion on success and failure, including authentication rejection and unhandled errors. All entry, exit, and response-result logs MUST carry the same context-derived `traceId` (= `X-Request-Id`, §5). For token-authenticated endpoints, record whether each applicable auth header was supplied, e.g. `authorizationPresent` / `internalTokenPresent` as booleans; include `false` when absent. Presence does not imply successful authentication. Never log header values or token contents.

**Health checks log only errors.** Apply this to `/health`, `/health/*`, and any configured liveness/readiness probe routes. Suppress routine entry, exit, payload, and dependency-success logs at every level, including `debug`. If a health check fails (non-2xx, timeout, or exception), log the error with `traceId`, probe name/path, status when available, `elapsedMs`, and sanitized diagnostic context. Probe availability is tracked by metrics (`http_requests_total`, see §9).

### 4.2 Business Logic (Service / Use-Case Layer)

| Position | Level | What to log |
|----------|-------|-------------|
| State transition | `info` | Entity ID, `from` -> `to` state, reason |
| Business rule branch | `info` or `debug` | Which branch was taken and why (`outcome: skipped`) |
| Idempotency / duplicate detection | `info` | Key ID, `outcome: skipped` |
| Compensation / rollback | `warn` | What was rolled back and trigger reason |

### 4.3 External Calls

| Position | Level | What to log |
|----------|-------|-------------|
| Before outbound call | `info` | Target service, HTTP method, host/path, operation, timeout, sanitized request parameters and bounded JSON `requestBody` (§6.3) |
| After outbound call (success) | `info` | Target, operation, HTTP `statusCode`, `elapsedMs`, `outcome: success` |
| After outbound call (failure) | `error` or `warn` | Target, operation, HTTP `statusCode` when received, `elapsedMs`, sanitized error, retry count |
| Outbound response result (success or failure) | `debug` | Target, operation, sanitized and bounded JSON `responseBody` (§6.3) |

Every third-party service call MUST log its request and completion, including non-2xx responses, timeouts, and transport failures. All related logs reuse the initiating request/job's context-derived `traceId`; forward it as `X-Request-Id` (§5). Record status codes only when a response exists; otherwise identify the timeout/transport error. Measure elapsed time for each attempt, with attempt/retry context when retrying. Response bodies and parsed business results belong at `debug`, including on failure; keep status, timing, and sanitized error summaries at the levels above. Health-check calls follow §4.1's error-only rule.

### 4.4 Data Access

| Position | Level | What to log |
|----------|-------|-------------|
| Query affecting user-visible outcome | `debug` | Operation name, entity type/ID — **not** raw SQL with values |
| Transaction commit/rollback | `debug` | Scope (operation name), `outcome` |
| Data store call failed but was absorbed (treated as miss, retried, degraded) | `warn` | Operation name, entity type, sanitized error |
| Optimistic lock / conflict | `warn` | Entity ID, conflict type |

Own database, cache, and queue access is in-process infrastructure, not a third-party upstream — routine access stays at `debug` per §3. Only failures and outcome-changing events rise to `warn`/`info`.

### 4.5 Errors

| Position | Level | What to log |
|----------|-------|-------------|
| Expected business error (mapped to 4xx) | `warn` | `errorCode`, sanitized `message`, context IDs |
| Unexpected system error (mapped to 5xx) | `error` | `errorCode`, sanitized `message`, stack trace (server only) |
| Swallowed/recovered error | `warn` | What was recovered and fallback taken |

## 5. Correlation (traceId)

`traceId` is the single correlation ID that ties all logs in a request/workflow together. It maps to the `X-Request-Id` HTTP header (see [HTTP Constitution](http-constitution.md) §7.1).

### 5.1 Generation and Propagation

| Role | Rule |
|------|------|
| **Server** | Generate or propagate `traceId` at the HTTP boundary via the `X-Request-Id` header. If the client provides `X-Request-Id`, use it as `traceId`; otherwise generate one. Include it in every downstream log and outbound request header. |
| **Web / Client** | Read `X-Request-Id` from API response headers; use it as `traceId` in client-side logs for the same user action. |
| **Async work** | Pass `traceId` into background jobs, queue messages, and async tasks — never lose correlation mid-flow. |
| **Cross-module** | When module A calls module B, B's logs must share A's `traceId`. |

**Carry `traceId` through the context, never by hand.** Every logging call in a request/workflow path MUST take the ambient context (`ctx`, `AsyncLocalStorage`, MDC, or the language equivalent), and the logger MUST extract `traceId` from it and attach it automatically. Business code never passes `traceId` as an explicit field — manual threading is how lines end up uncorrelated. Startup and shutdown logs, which have no context, are the only exception.

### 5.2 Synchronous Inter-Service Calls

When service A makes an HTTP call to service B, A MUST forward `X-Request-Id` in the outbound request header. B reads it, uses it as `traceId` in all its logs, and returns it in the response header.

```
Client --> Service A (user-service) --> Service B (payment-service)

Headers on every hop:
  X-Request-Id: 7f3e2a1b-9c8d-4e5f-a6b7-c8d9e0f1a2b3
```

All logs across both services share the same `traceId` (excerpts below show correlation fields; actual entries also include all required fields from §2.2):

```json
// Service A log
{ "traceId": "7f3e2a1b-...", "module": "user-service", "component": "api_client", "operation": "call_payment", "message": "payment: call completed", "target": "payment-service", "elapsedMs": 142, "outcome": "success" }

// Service B log
{ "traceId": "7f3e2a1b-...", "module": "payment-service", "component": "payment_service", "operation": "authorize_payment", "message": "payment: authorized", "orderId": "ord_123", "elapsedMs": 98, "outcome": "success" }
```

Searching any log aggregator for `traceId=7f3e2a1b-...` returns the complete chain from both services.

### 5.3 Asynchronous / Message Queue Calls

When service A publishes an event and service B consumes it asynchronously, the message payload MUST carry `traceId` as a top-level field. B extracts it and uses it as `traceId` in all logs for that consumption.

**Message envelope (required field):**

```json
{
  "traceId": "7f3e2a1b-9c8d-4e5f-a6b7-c8d9e0f1a2b3",
  "eventType": "order.created",
  "timestamp": "2026-06-06T08:30:00.123Z",
  "data": { "orderId": "ord_123" }
}
```

**Propagation rules:**

| Role | Rule |
|------|------|
| **Publisher** | When the publish originates from an HTTP request, reuse the request's `traceId`. When it originates from a background job or cron, generate a new `traceId` for the job and attach it to all published messages. |
| **Consumer** | Extract `traceId` from the message envelope. Use it in all logs produced during consumption. If the consumer makes further outbound calls (HTTP or message), forward the same `traceId`. |
| **Multiple consumers** | If one event is consumed by multiple services, all consumers share the same `traceId` — enabling full fan-out tracing. |
| **Missing traceId** | If a message arrives without `traceId`, the consumer MUST generate one and log a `warn` noting the gap. Never proceed without a `traceId`. |

## 6. Data Protection

### 6.1 Never log, at any level

- Passwords, API keys, tokens, session secrets, encryption keys, raw authentication headers
- Full credit card numbers, government IDs
- Unsanitized or unbounded request/response payloads (§6.3 defines bounded, sanitized JSON logging)
- Health or financial data beyond opaque IDs

**Upstream URLs can carry credentials.** When an outbound provider takes its API key in the query string, log `host` and `path` only and drop the query string wholesale. Never log an assembled URL that may embed a key. Log only allowlisted, sanitized query parameters separately as structured JSON fields (§6.3).

### 6.2 Graded by level

Quasi-identifiers are not banned outright — they are gated by level:

| Data | At `info` and above | At `debug` |
|------|--------------------|------------|
| Precise geolocation and other quasi-identifiers | Coarsen (e.g. round coordinates to ~1 km) or omit | Raw value allowed |
| Client IP | Omit | Allowed |
| User-supplied free text (search terms, message content) | Omit | Allowed |
| Stack traces | Server only; never in production-facing client builds | Server only |

`debug` is off in production by default (§3), so these allowances only take effect inside a deliberate troubleshooting window. Even at `debug`, redact known sensitive fields when inspecting payloads.

### 6.3 Request and response payloads

- Log path/query parameters as structured JSON objects. For JSON requests and responses, capture a sanitized JSON value under `requestBody` / `responseBody`; response bodies and parsed results are logged only at `debug`. Apply §6.1's bans and §6.2's level-specific rules before logging any parameters or payloads.
- Bound each logged body to **8 KiB of serialized UTF-8 by default**, or the project's explicit limit. Redact first, then enforce the limit; for oversized bodies emit a bounded preview with `bodyTruncated: true` and the original byte count (`bodyBytes`) when known. Keep the log entry valid JSON; never emit a raw truncated JSON fragment.
- Use bounded capture / serialization; do not read or buffer an unbounded body solely for logging. For non-JSON payloads (files, multipart, binary, streams), log content type and known size only. Capturing logs must preserve the request/response stream and must not break request handling if capture or serialization fails.
- Check the log level before capturing or serializing response payloads so disabled `debug` logging does not incur payload-copying work. Never dump raw headers, credentials, or unfiltered objects as a shortcut.

## 7. CLI and Batch Tool Logging

Applies to command-line tools, importers, migration scripts, and one-shot batch jobs — anything an operator runs directly rather than a request path.

### 7.1 Setup

- **Same logger as the service.** Construct it with the same logger module the service uses; do not hand-roll a second logging path.
- **Read the environment directly.** Initialize from `LOG_LEVEL` / `LOG_FORMAT` env vars rather than the service's full config loader — subcommands that never touch the database must not be blocked by unrelated required config (e.g. `DATABASE_URL`).
- **Defaults differ from the service:** `LOG_FORMAT` defaults to `text` (a human reads it locally); services default to `json`.
- **Logs go to stderr** (§2.5).

### 7.2 Command skeleton

Every command logs two mandatory lines:

| Position | Level | What to log |
|----------|-------|-------------|
| Command start | `info` | `cmd` name and the key parameters |
| Command end | `info` | Result counts (`total`, `done`, `failed`) and `elapsedMs` |

### 7.3 Progress granularity

Follows the §3 judgement rule:

| Work item | Level | Notes |
|-----------|-------|-------|
| Per-item work crossing the network boundary (downloads, third-party API calls, embedding batches) | `info` | Include `done` / `total` progress counters and `elapsedMs` |
| Per-item in-process or own-database work (file parsing, row upsert) | `debug` | Close with a single `info` summary |
| One item failed, the command continues | `warn` | Include the item identity and the current progress |
| The command aborts on error | — | The last log before the abort MUST carry locating context (which item, which batch, progress so far). Return the error to the entry point and let it write to stderr — do not double-log it |

### 7.4 Fields and correlation

- `traceId` does not apply — there is no request chain. A background job running *inside* a service still generates one (§5.3).
- §2.2 naming and §6 data protection apply unchanged.
- Additional vocabulary: `cmd`, `total`, `done`, `failed`, `elapsedMs`, `batch`, `file`.

### 7.5 Command output is not logging

A command's human-facing product (a comparison summary, a report path, JSON meant to be piped) goes to **stdout** via the command's own printer and is outside this convention. Keeping it off stderr is exactly what makes both streams usable.

## 8. Client-Specific Notes

| Concern | Guideline |
|---------|-----------|
| Offline / batch upload | Buffer structured logs locally; attach `traceId` on sync |
| User-visible errors | Log the technical detail server-side; show sanitized message in UI |
| Performance | Avoid synchronous logging on UI hot paths; use async/batched sinks |
| Crash reports | Include `traceId`, app version, and last N correlated log entries |

Module-specific logger setup (SDK choice, sink config) lives in each module's `docs/specs/` and MUST conform to this convention. Go services implement request logging in `internal/middleware/logger.go` (see [go-project.md](golang/go-project.md)).

## 9. Metrics and Distributed Tracing

- **Metrics** (QPS, latency, error rate): Required for HTTP services — see [HTTP Constitution](http-constitution.md) §9.
- **Distributed tracing**: When a tracing backend (OpenTelemetry, Jaeger, etc.) is enabled, the W3C `traceparent` header propagates alongside `X-Request-Id`. Logs and spans must share the same correlation ID (`traceId` = `X-Request-Id` value).
- Logging complements metrics/tracing — it does not replace them.

## 10. Implementation Checklist

When adding or modifying business logic:

- [ ] Backend HTTP requests log entry and completion, including rejection/error paths, with method/path, sanitized parameters and bounded JSON request body, status/outcome, and `elapsedMs`; response bodies/results appear only at `debug`
- [ ] Every branch that affects outcome has a log (or a single summary log with `outcome`)
- [ ] Third-party calls log request parameters/JSON body, completion status (when available), and `elapsedMs`; response bodies/results appear only at `debug`, with retry context per attempt
- [ ] Failures follow §3: `warn` for absorbed infrastructure failures or expected business rejections, `error` for propagated system failures
- [ ] `traceId` is present on all logs in the request path, taken from the context rather than passed by hand
- [ ] Token-authenticated endpoints log applicable auth-header presence as booleans, never header values
- [ ] Health checks produce only error logs; routine entry/exit/payload and dependency-success logs are suppressed at all levels
- [ ] No sensitive data in any field; quasi-identifiers (IP, precise coordinates, user text) are coarsened or omitted above `debug`; JSON payloads are sanitized and size-bounded per §6.3
- [ ] Field names follow camelCase and match this convention
- [ ] `module` preserves the actual module/repo name; `component` and `operation` use lowercase with underscores; `message` uses a stable `domain: event` prefix
- [ ] CLI commands log start/end with `elapsedMs`, write logs to stderr, and keep command output on stdout

## 11. Summary

**Structured fields + correlation ID + logs at logic boundaries = debuggable production systems.**

This convention is an organization-wide mandatory standard. All new code must comply; existing systems migrate incrementally when touching related logic.
