# HUB documentation

| Document | What it answers |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | what the HUB is |
| [FRONTEND.md](FRONTEND.md) | structure, routes, data states, pagination, accessibility |
| [adr/](adr/) | platform architecture decisions, including identity and SSO policy |

## Pointers, not copies

[API.md](API.md), [RBAC.md](RBAC.md) and [GLOBAL-IDS.md](GLOBAL-IDS.md) are
one-page pointers at the Integration Core, which is where those concepts are
enforced and therefore where they are documented.

They used to be full copies written before the Integration Core existed, and
the RBAC one had drifted into saying something false — that the HUB decides
what a user may do. The pointers say so explicitly rather than quietly
dropping it, because a reader who remembers the old claim deserves to find out
it was wrong.

The rule: **a platform concept is documented where it is enforced.** A second
copy drifts, and a reader cannot tell which copy is current.
