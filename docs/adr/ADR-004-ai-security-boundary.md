# ADR-004: AI Security Boundary

- Status: Accepted
- Date: 2026-09-15

## Context

BSYSTEM AI will consume context from CRM, Projects, QA, Wiki, Operations and future modules. Direct unrestricted access from an LLM to source databases would bypass authorization boundaries and increase data-leakage risk.

## Decision

AI access must flow through controlled BSYSTEM services.

```text
User
  -> authentik
  -> BSYSTEM-HUB authorization
  -> BSYSTEM AI Gateway
  -> Integration Core
  -> permitted source data
  -> model provider
```

## Requirements

- AI never receives user passwords, API secrets or raw credentials.
- Secrets and tokens are redacted before model invocation.
- User permissions and resource scopes are evaluated before context retrieval.
- AI must not query arbitrary source databases directly.
- Every AI request records audit metadata: user, model, sources, entity scopes and action type.
- Model routing may select local or cloud models according to data classification.
- Sensitive data classes may be restricted to local models or prohibited entirely.

## Initial components

- AI Gateway
- RAG / semantic search
- Model Router
- AI Audit
- domain agents introduced later

## P0 implication

P0 does not implement AI features, but must provide the prerequisites:

- global IDs
- RBAC and scopes
- audit
- clean API boundaries
- event contracts
- data classification hooks

## Consequences

AI is treated as a platform client with constrained access, not as a superuser. This may add latency and implementation complexity but preserves the same security model used by human users and other services.
