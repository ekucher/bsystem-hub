# API

**The authoritative contract is
[`bsystem-integration-core/docs/openapi.yaml`](https://github.com/ekucher/bsystem-integration-core/blob/main/docs/openapi.yaml),
with the conventions behind it in
[`API.md`](https://github.com/ekucher/bsystem-integration-core/blob/main/docs/API.md).**

This file used to describe an API surface the HUB would serve. The HUB serves
none: it is a static bundle behind nginx, and every request it makes goes to
the Integration Core.

## What this repository does document

- [FRONTEND.md](FRONTEND.md) — how the HUB consumes that API: the client, the
  data states, pagination, and why authorization in the interface is
  presentation only.
- `src/api/types.ts` — the TypeScript mirror of the contract. It contains no
  upstream field name — no EspoCRM `accountId`, no Redmine `identifier` —
  except where the normalized contract itself exposes one.

## The one rule

**The HUB consumes the normalized API and nothing else.** It never reaches an
upstream system, never handles an upstream payload shape, and never
reconstructs a platform decision locally. If something the HUB needs is not in
the normalized contract, the fix is in the Integration Core.
