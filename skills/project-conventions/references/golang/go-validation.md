# Go Input Validation Convention v1.0

> Applies to: All Go microservices | Goal: Standardize request parameter validation rules, error formats, and implementation patterns

This document extends [HTTP Constitution](../http-constitution.md) §4.2–§4.3 and [error-codes.md](../error-codes.md) with Go-specific validation rules. The `ValidateStruct` utility lives in `pkg/validator/` (see [go-project.md](go-project.md)). General error-handling idioms are in [go-style.md](go-style.md) §6.

## 1. Validation Library

**Mandatory:** All Go services must use `github.com/go-playground/validator/v10`

## 2. Usage

### 2.1 Request Struct Tag

Declare validation rules on request structs via the `validate` tag:

```go
type loginRequest struct {
    Email    string `json:"email" validate:"required,email"`
    Password string `json:"password" validate:"required,min=8"`
}
```

### 2.2 Handler Invocation

After JSON decoding, call `ValidateStruct()` to perform validation:

```go
var req loginRequest
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
    Error(w, errs.ErrValidation.WithMessage("invalid request body"))
    return
}

if err := ValidateStruct(&req); err != nil {
    Error(w, err)
    return
}
```

### 2.3 ValidateStruct Implementation

Each service provides a `ValidateStruct(v any) *AppError` utility function with the following responsibilities:

- Instantiate via `validator.New(validator.WithRequiredStructEnabled())`
- Register JSON tag name mapping (error messages use camelCase field names)
- Convert `validator.ValidationErrors` to a unified `*AppError`
- Singleton pattern with lazy initialization

## 3. Standard Validate Tags

### 3.1 Common Tags

| Tag | Description | Example |
|-----|-------------|---------|
| `required` | Mandatory; zero values rejected | `validate:"required"` |
| `email` | Valid email format | `validate:"email"` |
| `url` | Valid URL | `validate:"url"` |
| `min=N` | Minimum string length / numeric value | `validate:"min=1"` |
| `max=N` | Maximum string length / numeric value | `validate:"max=100"` |
| `len=N` | Exact length | `validate:"len=11"` |
| `oneof=A B C` | Enumerated values | `validate:"oneof=ios android web"` |
| `uuid` | UUID format | `validate:"uuid"` |
| `omitempty` | Skip subsequent rules when the field is a zero value | `validate:"omitempty,min=1"` |

> **Note:** Database IDs use BIGSERIAL/BIGINT (int64), not UUID. For ID path parameters, parse with `strconv.ParseInt(..., 10, 64)` and validate as integer. The `uuid` tag is only applicable to non-ID fields that use UUID format (e.g., external identifiers).

### 3.2 Combining Rules

Multiple rules are comma-separated:

```go
Nickname string `validate:"required,min=1,max=100"`
```

`omitempty` and `required` are mutually exclusive. For optional fields, prefix with `omitempty`.

## 4. Error Response Format

Validation failures uniformly return:

- **HTTP Status**: `400 Bad Request`
- **Business Code**: `1001` (parameter error — see [error-codes.md](../error-codes.md) and [HTTP Constitution](../http-constitution.md) §4.3 for error code ranges)
- **message**: Human-readable field-level error descriptions; multiple errors separated by `; `

**Example:**

```json
{
  "code": 1001,
  "message": "email is required; password must be at least 8 characters"
}
```

**Error Message Format Rules:**

| Validation Rule | Error Message Template |
|-----------------|----------------------|
| `required` | `{field} is required` |
| `min` | `{field} must be at least {param} characters` |
| `max` | `{field} must be at most {param} characters` |
| `email` | `{field} must be a valid email` |
| `url` | `{field} must be a valid URL` |
| Other | `{field} {tag} validation failed` |

`{field}` uses the JSON tag name (camelCase), not the Go struct field name.

## 5. Special Type Handling

### 5.1 Optional / PATCH-Semantic Fields

For PATCH requests, three-state fields ("omitted = no change, null = clear") such as `OptionalString` are not suited for direct `validate` tags. Handle them as follows:

- Do not add `validate` tags to custom types like `OptionalString`
- After parsing, validate internal values through hand-written logic (e.g., length, format)
- Still call `ValidateStruct()` to process other tagged fields on the struct

### 5.2 URL Params / Query Params

Path parameters and query parameters are not part of the request body struct. Validate them as follows:

- **Path parameters**: Parse and validate manually in the handler
- **Query parameters**: Define a query struct with `validate` tags, manually assign values from `r.URL.Query().Get()`, then validate

### 5.3 Header Validation

Request header validation (e.g., `X-Client-Platform`) is handled in middleware, not via `validate` tags.

## 6. Prohibited Patterns

- ❌ Writing manual `if field == ""` checks in handlers instead of using `validate:"required"`
- ❌ Using Go struct field names in error messages (use JSON tag camelCase names instead)
- ❌ Returning a business code other than `1001` for validation errors
- ❌ Adding `validate` tags directly to custom types like `OptionalString`
