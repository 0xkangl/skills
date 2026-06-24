# Observability Convention v1.0

> Applies to: All modules (server, web, client, dev tools) | Goal: Standardize logging, tracing, and diagnostic output so logic flows are analyzable and incidents are locatable

For the full convention index, see [../SKILL.md](../SKILL.md).

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
| `message` | Yes | Short human-readable summary of the event | `payment authorized` |
| `traceId` | Yes* | Request/workflow correlation ID | `a1b2c3d4-...` |
| `module` | Yes | Originating workspace module name | `user-service`, `api-gateway` |
| `component` | Yes | Package, layer, or file area (lowercase) | `payment_service`, `api/client` |
| `operation` | Recommended | Function or business action name (lowercase) | `authorize_payment`, `create_order` |

*Client offline logs may defer `traceId` until sync; must attach one before upload.

**Naming rules:**

- All **field names** use camelCase (`traceId`, `durationMs`, `orderId`).
- All **field values** for `module`, `component`, and `operation` use lowercase with underscores (e.g., `payment_service`, `authorize_payment`).
- `module` MUST use the workspace module/repo name (e.g., `user-service`, `api-gateway`), NOT the template name (e.g., not `server`).

### 2.3 Context Fields

Additional context fields (add as needed):

| Field | When to include |
|-------|-----------------|
| `userId` | When the action is user-scoped (never log email/phone as identifier) |
| `entityId` | When acting on a domain entity (`orderId`, `sessionId`) |
| `durationMs` | After completing an operation or external call |
| `errorCode` | On business or system errors (align with [error-codes.md](./error-codes.md)) |
| `outcome` | `success` / `failure` / `skipped` for branch decisions |

### 2.4 Format Examples

**JSON format** (`LOG_FORMAT=json`):

```json
{
  "timestamp": "2026-06-06T08:30:00.123Z",
  "level": "info",
  "message": "payment authorized",
  "traceId": "7f3e2a1b-9c8d-4e5f-a6b7-c8d9e0f1a2b3",
  "module": "user-service",
  "component": "payment_service",
  "operation": "authorize_payment",
  "orderId": "ord_123",
  "durationMs": 142,
  "outcome": "success"
}
```

**Text format** (`LOG_FORMAT=text`):

```text
2026-06-06T08:30:00.123Z info payment authorized traceId=7f3e2a1b-9c8d-4e5f-a6b7-c8d9e0f1a2b3 module=user-service component=payment_service operation=authorize_payment orderId=ord_123 durationMs=142 outcome=success
```

### 2.5 Output

- Logs MUST be written to **stdout** by default. Let the runtime environment (Docker, systemd, Kubernetes) route stdout to the appropriate sink.
- Module configs MAY override the destination for specific environments, but stdout is the baseline.

## 3. Log Levels

| Level | Use when | Examples |
|-------|----------|----------|
| `error` | Operation failed; requires attention or retry | DB connection lost, unhandled exception, external API 5xx |
| `warn` | Degraded but recoverable; business rule rejection | Retry attempt, rate limit hit, validation rejected by rule |
| `info` | Significant business events and state transitions | Entity created/updated, workflow step completed, auth success |
| `debug` | Diagnostic detail for development/troubleshooting | Branch taken, cache hit/miss, computed intermediate values |

**Rules:**

- Production default: `info`. Enable `debug` only via environment/config, never hard-coded.
- One `error` per failure path — log at the point you handle or propagate the error, not at every wrapper.
- Do not use `info` for high-frequency loops (per-row, per-tick). Aggregate or use `debug`.

## 4. Logic Positions

Log at **decision points** and **boundaries**, not on every statement.

### 4.1 Entry and Exit (Boundaries)

| Position | Level | What to log |
|----------|-------|-------------|
| HTTP handler / API route entry | `info` | Method, path (or operation name), key input IDs — not full request body |
| HTTP handler exit | `info` | Status/outcome, `durationMs` |
| Background job / cron start & end | `info` | Job name, batch size, `durationMs`, outcome |
| Message consumer receive & ack/nack | `info` | Topic/queue, message ID, outcome |

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
| Before outbound call | `debug` | Target service, operation, timeout |
| After outbound call (success) | `info` | Target, operation, `durationMs`, `outcome: success` |
| After outbound call (failure) | `error` or `warn` | Target, operation, `durationMs`, sanitized error, retry count |

### 4.4 Data Access

| Position | Level | What to log |
|----------|-------|-------------|
| Query affecting user-visible outcome | `debug` | Operation name, entity type/ID — **not** raw SQL with values |
| Transaction commit/rollback | `info` | Scope (operation name), `outcome` |
| Optimistic lock / conflict | `warn` | Entity ID, conflict type |

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

### 5.2 Synchronous Inter-Service Calls

When service A makes an HTTP call to service B, A MUST forward `X-Request-Id` in the outbound request header. B reads it, uses it as `traceId` in all its logs, and returns it in the response header.

```
Client --> Service A (user-service) --> Service B (payment-service)

Headers on every hop:
  X-Request-Id: 7f3e2a1b-9c8d-4e5f-a6b7-c8d9e0f1a2b3
```

All logs across both services share the same `traceId`:

```json
// Service A log
{ "traceId": "7f3e2a1b-...", "module": "user-service", "component": "api/client", "operation": "call_payment", "message": "outbound call completed", "target": "payment-service", "durationMs": 142, "outcome": "success" }

// Service B log
{ "traceId": "7f3e2a1b-...", "module": "payment-service", "component": "payment_service", "operation": "authorize_payment", "message": "payment authorized", "orderId": "ord_123", "durationMs": 98, "outcome": "success" }
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

## 6. Prohibited Content

Never log:

- Passwords, API keys, tokens, session secrets, encryption keys
- Full credit card numbers, government IDs, or raw authentication headers
- Complete request/response bodies that may contain PII
- Health or financial data beyond opaque IDs
- Stack traces at `info` or `warn` level in production-facing client builds

When debugging requires payload inspection, use `debug` level behind a feature flag and redact known sensitive fields.

## 7. Client-Specific Notes

| Concern | Guideline |
|---------|-----------|
| Offline / batch upload | Buffer structured logs locally; attach `traceId` on sync |
| User-visible errors | Log the technical detail server-side; show sanitized message in UI |
| Performance | Avoid synchronous logging on UI hot paths; use async/batched sinks |
| Crash reports | Include `traceId`, app version, and last N correlated log entries |

Module-specific logger setup (SDK choice, sink config) lives in each module's `docs/specs/` and MUST conform to this convention. Go services implement request logging in `internal/middleware/logger.go` (see [go-project.md](golang/go-project.md)).

## 8. Metrics and Distributed Tracing

- **Metrics** (QPS, latency, error rate): Required for HTTP services — see [HTTP Constitution](http-constitution.md) §9.
- **Distributed tracing**: When a tracing backend (OpenTelemetry, Jaeger, etc.) is enabled, the W3C `traceparent` header propagates alongside `X-Request-Id`. Logs and spans must share the same correlation ID (`traceId` = `X-Request-Id` value).
- Logging complements metrics/tracing — it does not replace them.

## 9. Implementation Checklist

When adding or modifying business logic:

- [ ] Entry and exit of the operation have `info` logs with `operation`, key IDs, and `durationMs`
- [ ] Every branch that affects outcome has a log (or a single summary log with `outcome`)
- [ ] External calls log success/failure with `durationMs`
- [ ] Errors use the correct level (`warn` for expected, `error` for unexpected)
- [ ] `traceId` is present on all logs in the request path
- [ ] No sensitive data in any field
- [ ] Field names follow camelCase and match this convention
- [ ] `module`, `component`, `operation` values use lowercase with underscores

## 10. Summary

**Structured fields + correlation ID + logs at logic boundaries = debuggable production systems.**

This convention is an organization-wide mandatory standard. All new code must comply; existing systems migrate incrementally when touching related logic.
