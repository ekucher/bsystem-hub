# ADR-001: BSYSTEM Platform Base Stack

- Status: Accepted
- Date: 2026-09-15

## Context

BSYSTEM requires a self-hosted, modular platform that can start on Docker Compose and later scale to Kubernetes without redesigning service boundaries.

## Decision

Use the following baseline stack for BSYSTEM-owned components:

### Frontend
- React
- TypeScript
- Vite

### Backend
- Go for new platform backend services by default

### Data
- PostgreSQL for durable relational state
- Redis for cache, rate limits and ephemeral coordination

### Identity
- authentik via OIDC/OAuth2

### Integration
- REST APIs as the initial synchronous contract
- Webhooks for external event ingestion
- NATS for asynchronous events when required

### Search
- OpenSearch when cross-module search is introduced

### Observability
- Prometheus
- Grafana
- Loki
- OpenTelemetry where practical

### Runtime
- Docker Compose for DEV/STAGE and initial production
- Kubernetes/k3s is a future deployment target, not a P0 requirement

## Rationale

The stack favors operational simplicity, open protocols, container portability and clear separation between BSYSTEM-owned code and third-party applications.

## Consequences

- Third-party modules may use different implementation stacks internally.
- Integration is through supported APIs/adapters rather than shared databases.
- Services should remain stateless where practical.
- Kubernetes-specific assumptions must not leak into application business logic.
