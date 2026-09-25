# ADR-006: Module Launch URL Origin Policy

- Status: Accepted
- Date: 2026-09-25

## Context

`/admin/modules` (module administration, this record's companion feature)
lets an operator with the `module.admin` permission register a
`launch_url` for a catalog entry, which the launcher (`Dashboard.tsx`) then
renders as a clickable link (`safeModuleLaunchUrl`, REM-3).

REM-3 validated only the URL's *protocol* (`https:` only, rejecting
`javascript:`/`data:`/malformed values) and deliberately left the *origin*
question open — see `.unlazy/audit/REMEDIATION.md`, disposition `HOLD` for
`REM-3-ARCH`: same-origin only, an explicit allowlist, or any HTTPS origin.
That question could stay open as long as no one but a developer editing code
could set `launch_url`. Module administration removes that constraint: any
`module.admin` can now set it at runtime, so leaving origin trust unresolved
would let an admin (or an admin account compromise) turn the launcher into an
open redirector to an arbitrary HTTPS origin.

## Decision

A module's `launch_url` must resolve under one of the platform's registered
canonical origins (ADR-005's `hub.<domain>`, `cloud.<domain>`,
`redmine.<domain>`, `wiki.<domain>`, and so on) — an explicit allowlist, not
same-origin-only (HUB must link to other modules' origins by design) and not
arbitrary HTTPS (an operator mistake or compromised admin account must not be
able to point the launcher anywhere on the internet).

```text
Integration Core config: canonical origin allowlist
        │
        ▼
GET /api/v1/admin/modules/allowed-origins  ──►  admin form offers only these
        │
        ▼
POST/PATCH /api/v1/admin/modules   ──►  Integration Core re-validates against
                                          the same allowlist before persisting
```

- The allowlist is Integration Core configuration, not a HUB constant — it is
  the same list of canonical origins operations already maintains for DNS/TLS
  under ADR-005, not a second source of truth.
- The admin form (`src/pages/Modules.tsx`) offers the allowlist as a
  `<select>`, plus a free-text path suffix joined onto the chosen origin. An
  operator cannot type an origin that was never offered.
- The server enforces the same allowlist independently on write. The HUB
  control is a usability aid (REM-3-ARCH's framing: "hidden UI is never an
  authorization boundary" applies to input constraints too), not the
  enforcement point.
- `safeModuleLaunchUrl`'s existing protocol check (REM-3) is unchanged and
  still runs at render time — this decision adds an origin check at write
  time, it does not replace the render-time protocol check.

## Consequences

- `REM-3-ARCH` in `.unlazy/audit/REMEDIATION.md` moves from `HOLD` to
  resolved by this record; its test-matrix row for an out-of-allowlist origin
  (`https://evil.example.com/phish`) is now in scope and enforced.
- Onboarding a new module's canonical origin (a new subdomain) requires an
  Integration Core configuration change before it can be selected in
  `/admin/modules` — registering a module and provisioning its origin are two
  steps, not one. This is consistent with ADR-005: origin provisioning is
  infrastructure (DNS/TLS/authentik client registration), catalog metadata is
  not.
- If `GET /api/v1/admin/modules/allowed-origins` returns no origins (not yet
  configured in a given deployment), the admin form still lets an operator
  create/edit a module without a `launch_url`, rather than blocking catalog
  administration entirely.
