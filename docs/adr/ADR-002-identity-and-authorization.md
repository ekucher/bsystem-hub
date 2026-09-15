# ADR-002: Identity and Authorization Separation

- Status: Accepted
- Date: 2026-09-15

## Decision

authentik is the central Identity Provider. BSYSTEM-HUB owns platform roles, permissions and scopes.

```text
authentik -> identity/groups -> BSYSTEM-HUB -> roles/permissions/scopes -> module backend
```

## authentik responsibilities

- authentication
- MFA
- users
- groups
- OIDC/OAuth2
- service accounts
- login policies

## BSYSTEM-HUB responsibilities

- group-to-role mapping
- permissions
- resource scopes
- module visibility
- authorization administration

## Module responsibility

Each module backend must enforce access to its own protected resources. A hidden UI control is never considered an authorization boundary.

## Rationale

Keeping identity separate from application authorization avoids encoding rapidly changing business permissions inside the IdP and reduces the need to modify authentik core.

## Consequences

- authentik can be upgraded independently.
- HUB must have a reliable authorization subsystem.
- downstream modules may require adapters or role synchronization.
- default access policy is deny.
