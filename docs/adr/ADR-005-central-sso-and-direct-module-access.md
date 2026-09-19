# ADR-005: Central SSO and Direct Module Access

- Status: Accepted
- Date: 2026-09-19

## Context

BSYSTEM modules must be usable both from BSYSTEM-HUB and through their own canonical URLs. Authentication must not depend on entering a module through HUB.

A user can have an application-local session that outlives or differs from the current browser session at the Identity Provider. OAuth/OIDC access tokens also remain valid until expiry unless explicitly revoked; a change of the IdP browser session does not by itself invalidate every already-issued application token.

## Decision

authentik is the single interactive authentication authority for the BSYSTEM ecosystem.

BSYSTEM-HUB is a portal and launcher, not an Identity Provider, authentication proxy, or token broker for modules.

Every interactive module that supports OIDC/OAuth2 is registered as its own authentik client and establishes its own application session directly from authentik.

```text
                         authentik
                    central authentication
                  users / groups / MFA / SSO
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
  BSYSTEM-HUB          Nextcloud           Redmine
   OIDC client         OIDC client         OIDC client
        │
        └────────────── launcher ──────────────► modules
```

## Required access paths

Both paths are first-class and must result in the same identity semantics.

Through HUB:

```text
user -> HUB -> authentik -> HUB -> module -> authentik -> module
```

Direct:

```text
user -> module canonical URL -> authentik -> module
```

When an authentik browser session already exists, a module should reuse SSO without asking for credentials again, subject to authentik policy.

## Session semantics

- authentik owns the central browser authentication session.
- Each module owns its local application session.
- HUB owns only its own OIDC session.
- HUB access tokens or ID tokens MUST NOT be passed to modules in URLs, query strings, fragments, cookies, or custom hand-off mechanisms.
- A module MUST NOT require a valid HUB session in order to authenticate a user.
- A valid application token proves the identity represented by that token; it does not prove that the current authentik browser session still represents the same user.
- Existing already-open module tabs are not required to change identity spontaneously when another authentik login occurs.
- On a new authentication entry/re-entry, the module must derive identity from authentik rather than from HUB.
- Local passwords for ordinary platform users should be disabled or avoided where the product permits it. Local administrative accounts are break-glass accounts only.

## Module launch policy

A HUB module registry entry contains a browser launch URL, not an authentication token.

The launch URL may be an application-specific SSO entry endpoint when the product needs one to replace a stale local session before starting OIDC. This endpoint is part of that module's integration and MUST still authenticate directly against authentik.

Direct canonical module URLs must remain supported independently of HUB. Where a product preserves stale local sessions on its root URL, the integration should provide an IdP-backed login/re-entry path and document the product-specific session behavior; HUB-specific token transfer is not an acceptable fix.

## Canonical origins

Production and stage deployments use HTTPS canonical origins, for example:

```text
auth.<domain>      authentik
hub.<domain>       BSYSTEM-HUB
cloud.<domain>     Nextcloud
redmine.<domain>   Redmine
wiki.<domain>      Outline
```

Each OIDC client has its own client ID and redirect URI on its canonical origin. Localhost and insecure HTTP are development-only exceptions.

## Authorization boundary

Central authentication does not replace authorization.

- authentik: identity, authentication, MFA, groups and login policy.
- Integration Core/platform authorization: platform roles, permissions, module visibility and integration policy.
- module backend: final authorization for module-owned resources.
- HUB: role-aware presentation and navigation; hidden UI is never an authorization boundary.

## Logout

Logout behavior must distinguish:

1. local application logout;
2. central authentik logout;
3. ecosystem-wide logout.

A module must not terminate the central authentik session merely to switch or refresh its own local application session unless the user explicitly requested central logout.

## Acceptance criteria

For each interactive module:

1. A signed-out browser opening the module directly is sent to authentik and can return authenticated.
2. A browser with an existing authentik session can open the module directly without re-entering credentials, subject to policy.
3. Launching the same module from HUB produces the same authenticated identity as a fresh direct OIDC entry.
4. No HUB access token or ID token is transferred to the module.
5. The module remains usable when HUB is unavailable, provided authentik and the module itself are available.
6. A stale local module session has a documented re-entry/synchronization behavior.
7. Break-glass local administration is separate from normal SSO use.

## Consequences

- Modules are independently addressable and independently deployable.
- HUB can be unavailable without becoming an authentication outage for every module.
- SSO policy is centralized in authentik while application authorization remains at the proper enforcement boundary.
- Some third-party modules require adapters or small integration extensions for stale-session re-entry.
- Session synchronization is an ecosystem concern, not a reason to make HUB an authentication broker.
