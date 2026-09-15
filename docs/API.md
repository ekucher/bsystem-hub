# BSYSTEM-HUB API Contract

Base path: `/api/v1`

## Conventions

- JSON request/response bodies
- UTF-8
- ISO 8601 timestamps in UTC
- `X-Request-ID` accepted and propagated
- authenticated endpoints require a valid HUB session derived from authentik OIDC
- authorization is always enforced server-side

## Error format

```json
{
  "error": {
    "code": "forbidden",
    "message": "Access denied",
    "request_id": "REQ-01H..."
  }
}
```

## GET /me

Returns current identity and effective access.

```json
{
  "id": "USR-000001",
  "subject": "authentik-subject-id",
  "email": "user@bsystem.com.ua",
  "name": "User Name",
  "groups": ["BSYSTEM-Developers"],
  "roles": ["Developer"],
  "permissions": [
    "projects.task.read",
    "development.repo.read",
    "qa.testcase.read"
  ]
}
```

## GET /modules

Returns only modules the current user may see.

```json
{
  "items": [
    {
      "id": "projects",
      "name": "BSYSTEM Projects",
      "url": "https://projects.example.local",
      "status": "available"
    }
  ]
}
```

## GET /permissions

Returns effective permissions and scopes.

```json
{
  "roles": ["Developer"],
  "permissions": ["projects.task.read"],
  "scopes": {
    "projects": ["PR-000103"]
  }
}
```

## GET /health

Unauthenticated operational endpoint.

```json
{
  "status": "ok",
  "service": "bsystem-hub",
  "version": "0.1.0",
  "timestamp": "2026-09-15T19:00:00Z"
}
```

## Future endpoints

Planned after P0:

- `GET /clients`
- `GET /clients/{id}`
- `GET /projects`
- `GET /projects/{id}`
- `GET /servers`
- `GET /servers/{id}`
- `GET /notifications`
- `GET /search`
- `GET /dashboard`

## HTTP semantics

- `200` success
- `201` created
- `204` success without body
- `400` invalid request
- `401` unauthenticated
- `403` authenticated but forbidden
- `404` resource not found or intentionally hidden by authorization policy
- `409` conflict
- `422` validation error
- `429` rate limit
- `500` internal error
- `503` dependent service unavailable
