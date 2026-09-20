# BSYSTEM-HUB Architecture

## Role in the platform

BSYSTEM-HUB is the user-facing orchestration layer of BSYSTEM Platform.

```text
authentik
   │ OIDC
   ▼
BSYSTEM-HUB
   │
   ├── Integration Core
   │    ├── CRM / EspoCRM
   │    ├── Projects / Redmine
   │    ├── QA
   │    ├── Wiki / Outline
   │    └── Operations
   │
   └── BSYSTEM AI
        ├── AI Gateway
        ├── RAG / Semantic Search
        ├── Agents
        ├── Model Router
        └── AI Audit
```

## Responsibility boundaries

### HUB owns

- user experience and navigation;
- application switcher;
- dashboard composition;
- role-aware presentation;
- profile and preferences;
- notification presentation;
- deep links and contextual navigation;
- frontend access to global search;
- frontend access to AI.

### HUB does not own

- passwords or MFA;
- CRM master data;
- Redmine issues;
- QA domain data;
- Wiki documents;
- Operations telemetry;
- source code repositories;
- cross-system synchronization logic.

These belong to authentik, source systems, or Integration Core.

## Authentication and authorization

Authentication is delegated to authentik using OpenID Connect. authentik is the single interactive authentication authority for the ecosystem; HUB is an OIDC client and launcher, not an Identity Provider or token broker. Interactive modules are independent OIDC clients and must also support direct access through their canonical URLs. See [ADR-005](adr/ADR-005-central-sso-and-direct-module-access.md).

A HUB launch URL contains navigation only. HUB access/ID tokens are never handed to a module. A module establishes its own session directly with authentik, whether it was opened from HUB or directly.

Authorization — deciding what an authenticated user may do — is Integration
Core's responsibility, not HUB's. Integration Core resolves permissions from
authentik groups and answers every request against them; the HUB frontend
guards routes and hides navigation using the permission list Integration Core
returned on `/api/v1/me`, but that guard is presentation only. A hidden UI
control is never an authorization boundary: the backend refuses the same
request regardless of what the HUB rendered. See [RBAC.md](../RBAC.md) and
[ADR-005](adr/ADR-005-central-sso-and-direct-module-access.md#authorization-boundary)
for the authoritative model — this corrects an earlier assignment in
[ADR-002](adr/ADR-002-identity-and-authorization.md) that gave HUB itself
"permissions, resource scopes, module visibility, authorization
administration," which ADR-005 supersedes.

Separation as implemented:

```text
authentik        = identity, users, groups, MFA
Integration Core = roles, permissions, scopes, authorization decisions
BSYSTEM-HUB      = role-aware presentation and navigation only
module backend   = final resource authorization
```

Example permission naming:

```text
crm.client.read
projects.task.edit
qa.testcase.execute
wiki.document.read
operations.server.manage
```

## Global IDs

Cross-system entities use immutable BSYSTEM identifiers.

```text
CL-000001   Client
PR-000001   Project
SRV-000001  Server
INC-000001  Incident
TST-000001  Test Case
DOC-000001  Document
REL-000001  Release
```

The mapping between BSYSTEM IDs and source-system IDs is owned by Integration Core.

## AI boundary

AI must never receive unrestricted direct database access.

```text
User
  ↓
authentik
  ↓
HUB authorization
  ↓
BSYSTEM AI Gateway
  ↓
Integration Core
  ↓
Authorized context only
```

Secrets, credentials and restricted fields must be redacted before model access.

## Runtime

As implemented in this repository:

- frontend: React + TypeScript + Vite, built to a static bundle;
- served by nginx (`nginxinc/nginx-unprivileged`) in a single Docker image — see the [Dockerfile](../Dockerfile) and [nginx.conf](../nginx.conf);
- no backend/BFF, database, or cache in this repository — the SPA holds no
  server-side state of its own and talks directly to Integration Core through
  nginx's `/api/` reverse-proxy location; all HUB-owned state is either the
  browser's own session (OIDC tokens, in `sessionStorage`) or resolved live
  from Integration Core on every load;
- reverse-proxy TLS termination and Docker Compose/orchestration for
  DEV/STAGE/production are managed outside this repository (see the platform
  deployment repository).

The P0 plan originally called for a dedicated backend/BFF, PostgreSQL and
Redis for HUB-owned state (see the earlier P0 planning history). That plan
was not implemented in this repository: the simpler direct-SPA-to-Integration-Core
design above is what actually ships, and no HUB-owned server-side state exists
today. If HUB-owned persistence is needed in the future, that remains an open
decision, not an assumption this document should still make.

## Non-functional principles

- graceful degradation when a module is unavailable;
- all APIs versioned under `/api/v1`;
- structured JSON logs (Integration Core and other backend services — this
  repository is a static frontend with no server-side logs of its own beyond
  nginx's access/error log);
- `X-Request-ID` propagated between services;
- every owned HTTP service exposes a liveness/health route; this repository's
  own nginx layer implements it as `GET /healthz` (see
  [nginx.conf](../nginx.conf)) rather than the `GET /health` path named in
  [P0-FOUNDATION.md](P0-FOUNDATION.md#health-contract) — that broader contract
  (JSON body, `/api/v1/health`) is Integration Core's, not this static
  frontend's;
- no secrets committed to Git;
- production access audited (by the services that hold production data;
  this repository does not itself record an audit trail — see
  [ADR-004](adr/ADR-004-ai-security-boundary.md)).
