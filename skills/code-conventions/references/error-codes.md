# Error Codes

All API errors use the `{code, message, details}` envelope. The `code` field is a business error code, distinct from the HTTP status code.

## Code Ranges

| Range       | Category    | HTTP Status Range |
| ----------- | ----------- | ----------------- |
| 1000-1999   | Parameter   | 400               |
| 2000-2999   | Auth        | 401, 403, 409, 429|
| 3000-3999   | Permission  | 403               |
| 4000-4999   | Business    | 400, 403, 404, 409|
| 5000+       | System      | 500               |

## Parameter Errors (1000-1999)

| Code | HTTP | Message | Trigger |
| ---- | ---- | ------- | ------- |
| 1001 | 400  | Parameter error | Request body, query params, or path params fail validation. The `details` field contains field-level error info. |

## Auth Errors (2000-2999)

<!-- Example entry — remove or replace with project-specific codes -->
| Code | HTTP | Message | Trigger |
| ---- | ---- | ------- | ------- |
| 2001 | 401 | Not authenticated | Missing or invalid `Authorization` header on a protected route. |

## Permission Errors (3000-3999)

<!-- Example entry — remove or replace with project-specific codes -->
| Code | HTTP | Message | Trigger |
| ---- | ---- | ------- | ------- |
| 3001 | 403 | Forbidden | User's role does not have access to the requested resource or action. |

## Business Errors (4000-4999)

### General

| Code | HTTP | Message | Trigger |
| ---- | ---- | ------- | ------- |
| 4001 | 400  | Business error | Generic business logic violation. Context-specific message provided. |

### Idempotency

| Code | HTTP | Message | Trigger |
| ---- | ---- | ------- | ------- |
| 4090 | 409  | Idempotency key conflict — request in progress | A request with the same idempotency key is already being processed, or the key was reused with a different request body. |
| 4091 | 400  | Invalid idempotency key format | The `Idempotency-Key` header value is not a valid UUID. |

## System Errors (5000+)

| Code | HTTP | Message | Trigger |
| ---- | ---- | ------- | ------- |
| 5001 | 500  | System error | Unexpected server error. Check server logs for details. |

## Success Code

Successful responses use `code: 0` with `message: "ok"`.

```json
{
  "code": 0,
  "message": "ok",
  "data": { ... }
}
```
