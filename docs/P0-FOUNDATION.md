# BSYSTEM-HUB P0 — Foundation

## Goal

Establish the minimum platform foundation required before integrating CRM, Projects, QA, Wiki, Operations and AI.

## Scope

P0 includes:

- Docker-based local/dev runtime
- authentik as the central Identity Provider
- OIDC login to BSYSTEM-HUB
- base RBAC model
- Integration Core connectivity
- global identifier specification
- service health contract
- audit baseline
- application switcher
- basic dashboard shell

## Required services

- `bsystem-hub`
- `bsystem-integration-core`
- `authentik`
- `postgresql`
- `redis`
- reverse proxy

Optional for P0:

- NATS
- OpenSearch

These may be introduced when the first event-driven or global-search feature is implemented.

## Authentication flow

```text
User
  -> BSYSTEM-HUB
  -> authentik
  -> OIDC authorization
  -> BSYSTEM-HUB callback
  -> authenticated session
  -> /api/v1/me
  -> RBAC evaluation
  -> dashboard
```

BSYSTEM-HUB MUST NOT store user passwords.

## Initial authentik groups

- `BSYSTEM-Admins`
- `BSYSTEM-Managers`
- `BSYSTEM-Developers`
- `BSYSTEM-QA`
- `BSYSTEM-Support`
- `BSYSTEM-Customers`

## P0 routes

Frontend:

- `/`
- `/login`
- `/dashboard`
- `/profile`
- `/admin`

Backend/API:

- `GET /api/v1/me`
- `GET /api/v1/modules`
- `GET /api/v1/health`
- `GET /api/v1/permissions`

## Minimum module registry

```json
[
  {"id":"crm","name":"BSYSTEM CRM","enabled":false},
  {"id":"projects","name":"BSYSTEM Projects","enabled":false},
  {"id":"qa","name":"BSYSTEM QA","enabled":false},
  {"id":"wiki","name":"BSYSTEM Wiki","enabled":false},
  {"id":"operations","name":"BSYSTEM Operations","enabled":false}
]
```

## P0 persistence

The HUB database may contain only HUB-owned data, including:

- local user preferences keyed by authentik subject
- role mappings
- permissions
- module registry
- favorites
- recent items
- audit metadata

The HUB database MUST NOT duplicate authoritative CRM, Redmine, QA, Wiki or Operations datasets.

## Security baseline

- HTTPS outside local-only development
- OIDC Authorization Code flow
- secure cookies
- CSRF protection where applicable
- strict input validation
- backend authorization on every protected API endpoint
- no secrets committed to Git
- structured audit logging
- `X-Request-ID` propagation

## Health contract

Every BSYSTEM-owned HTTP service MUST expose:

```http
GET /health
```

Example:

```json
{
  "status": "ok",
  "service": "bsystem-hub",
  "version": "0.1.0",
  "timestamp": "2026-09-15T19:00:00Z"
}
```

## Definition of Done

P0 is complete when:

1. A user can sign in through authentik.
2. HUB receives and validates OIDC identity.
3. `/api/v1/me` returns identity, groups, roles and permissions.
4. Unauthorized endpoints return `401` or `403` correctly.
5. App Switcher displays modules according to access rules.
6. HUB and Integration Core expose `/health`.
7. PostgreSQL and Redis are deployed through Docker Compose.
8. No secret is stored in the repository.
9. Audit records login/logout and administrative changes.
10. DEV environment can be recreated from repository configuration.

## Out of Scope

P0 does not include:

- CRM business functionality
- Redmine integration
- Outline integration
- QA integration
- BRAVO Operations integration
- global semantic search
- AI agents
- customer portal

These are added after the platform foundation is stable.
