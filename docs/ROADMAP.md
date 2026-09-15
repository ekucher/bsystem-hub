# BSYSTEM-HUB Roadmap

## P0 — Foundation

Goal: establish the secure platform skeleton.

- Docker-based development environment
- authentik OIDC integration
- user session and `/api/v1/me`
- base groups and roles
- application switcher
- dashboard shell
- module registry integration
- health overview
- notification shell
- audit hooks
- CI pipeline
- baseline documentation

## P1 — Business integration

- EspoCRM client context
- Redmine project/task context
- client card
- project card
- deep links between HUB and source systems
- initial global IDs

## P2 — Engineering and operations

- QA integration
- Development integration
- Outline integration
- Operations integration
- global search
- richer notifications

## P3 — AI Search

- BSYSTEM AI Gateway
- permission-aware RAG
- semantic search
- model routing
- AI audit
- local and cloud model providers

## P4 — AI Agents

- CRM assistant
- Project assistant
- QA assistant
- Development assistant
- Wiki assistant
- Operations assistant

## P5 — Customer Portal and automation

- tenant-aware customer portal
- customer documentation access
- incident visibility
- service status
- controlled workflow automation

## P0 Definition of Done

- user authenticates through authentik;
- HUB does not store passwords;
- roles/groups are visible to HUB;
- backend enforces authorization;
- Integration Core is reachable;
- every owned service exposes `/health`;
- request IDs and structured logs are present;
- no secrets are stored in repository;
- DEV deployment is reproducible from `bsystem-deploy`.
