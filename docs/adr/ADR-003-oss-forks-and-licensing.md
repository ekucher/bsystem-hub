# ADR-003: OSS, Forks and Licensing Policy

- Status: Accepted
- Date: 2026-09-15

## Context

BSYSTEM Platform integrates software with different licensing models, including MIT, GPL, AGPL and BSL. Uncontrolled source merging or deep forks can create upgrade and compliance risks.

## Decision

Customization priority is:

```text
Configuration
  -> API / Webhooks
  -> Plugin / Extension
  -> Adapter
  -> Fork
```

Forking upstream core is the last option.

## Boundary rule

BSYSTEM-owned platform code must remain separated from third-party licensed cores through process/API boundaries whenever practical.

```text
BSYSTEM-HUB / Integration Core
          |
          | REST / OIDC / Events
          v
Third-party application
```

## Initial third-party policy

### authentik
Prefer upstream distribution plus blueprints, policies, property mappings and API automation. Avoid modifying core unless no supported extension mechanism exists.

### EspoCRM
Prefer extension packages and API adapters. Keep proprietary platform orchestration outside the AGPL application core where practical.

### Redmine
Prefer plugins and REST API. Avoid core patches unless required.

### Outline
Prefer supported configuration/API/integration mechanisms. Any fork or production use must be reviewed against the BSL terms applicable to the exact version being used.

## Repository rules

- Keep upstream license and notices required by each dependency.
- Do not copy third-party source files into BSYSTEM-owned repositories without explicit review.
- Track upstream repository, version and license for every integrated product.
- Record local patches and their purpose.
- Maintain an upgrade strategy for every fork.
- Produce an SBOM for deployable BSYSTEM releases when the build pipeline supports it.

## Consequences

This approach may require more adapter code, but it reduces license coupling, security patch friction and long-term fork maintenance.

This ADR is an engineering compliance policy and is not a substitute for formal legal advice when commercial distribution or third-party hosted services are introduced.
