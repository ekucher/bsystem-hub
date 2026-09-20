# ADR-002: Identity and Authorization Separation

- Status: Accepted, partially superseded by [ADR-005](ADR-005-central-sso-and-direct-module-access.md)
- Date: 2026-09-15

**The "BSYSTEM-HUB responsibilities" section below assigning HUB "permissions,
resource scopes, module visibility, authorization administration" is
superseded.** ADR-005 (2026-09-19) reassigns platform authorization to
Integration Core; see [RBAC.md](../RBAC.md) for the corrected, current model
and why the earlier assignment changed. This record is kept as originally
written rather than edited, so the history of the decision remains legible.

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
