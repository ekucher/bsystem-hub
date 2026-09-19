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

Recommended separation:

```text
authentik      = identity, users, groups, MFA
BSYSTEM-HUB    = roles, permissions, scopes, UX
module backend = final resource authorization
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

P0 target:

- frontend: React + TypeScript + Vite;
- backend/BFF: Go or TypeScript service, final choice documented by ADR;
- PostgreSQL for HUB-owned state;
- Redis for cache/rate limiting where required;
- Docker Compose for DEV/STAGE;
- reverse proxy with HTTPS;
- OpenTelemetry-compatible observability.

## Non-functional principles

- graceful degradation when a module is unavailable;
- all APIs versioned under `/api/v1`;
- structured JSON logs;
- `X-Request-ID` propagated between services;
- `/health` endpoint on every owned service;
- no secrets committed to Git;
- production access audited.
