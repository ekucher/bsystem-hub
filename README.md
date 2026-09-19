# BSYSTEM-HUB

Central user-facing portal of the BSYSTEM Platform.

## Purpose

BSYSTEM-HUB is the central user-facing portal and launcher for BSYSTEM users. It provides authentication hand-off, application navigation, dashboard aggregation, global search, notifications, profile management, RBAC-aware UI, and deep links into connected modules. Modules remain independently accessible through their own canonical URLs.

BSYSTEM-HUB does **not** replace CRM, project management, QA, Wiki, Operations, or Support systems. It unifies them into one controlled workspace.

## Core principles

- Single Sign-On through authentik (OIDC); authentik is the central authentication authority.
- HUB and interactive modules are independent OIDC clients; modules do not depend on HUB for authentication.
- HUB never passes its access or ID tokens to modules.
- Authorization enforced on the backend; hidden UI is never treated as security.
- Independent modules connected through APIs and events.
- Global IDs for cross-system entity linking.
- No direct cross-database queries between modules.
- AI access is permission-aware and goes through BSYSTEM AI / Integration Core.
- Docker-first deployment.

## Platform modules

- **Identity** — authentik
- **CRM** — EspoCRM
- **Projects** — Redmine
- **QA** — BSYSTEM QA
- **Development** — Git/CI/CD aggregation
- **Wiki** — Outline
- **Operations** — BRAVO-Toolkit Dashboard / infrastructure operations
- **Support** — BSYSTEM Support
- **AI** — BSYSTEM AI Gateway, RAG, agents and model routing

## Initial scope (P0 Foundation)

- OIDC login through authentik
- `/api/v1/me`
- dashboard shell
- application switcher
- role-aware module visibility
- health status
- notifications shell
- audit hooks
- Integration Core connectivity

## Related repositories

- `ekucher/bsystem-integration-core`
- `ekucher/bsystem-design-system`
- `ekucher/bsystem-deploy`

See [Architecture](docs/ARCHITECTURE.md) and [Roadmap](docs/ROADMAP.md).
