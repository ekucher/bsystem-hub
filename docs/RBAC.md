# RBAC

**The authoritative document is
[`bsystem-integration-core/docs/AUTHORIZATION.md`](https://github.com/ekucher/bsystem-integration-core/blob/main/docs/AUTHORIZATION.md).**

This file used to describe the platform's RBAC model, and said that
"BSYSTEM-HUB answers what the user may do". **That is no longer true, and it
matters that it is written down as wrong rather than quietly deleted.**

The Integration Core answers what a user may do. It decides every request in
`internal/authz`, from a route inventory, against roles resolved from authentik
groups and scope grants held in its own database. The HUB does not participate
in that decision and cannot override it.

## What the HUB actually does with permissions

It hides links and guards routes, using the permission list the platform
returned on `/api/v1/me`.

**This is presentation, not security.** A hidden link is never the reason
something is protected: the Integration Core would refuse the data even if the
HUB rendered the page, and it is tested to. The HUB's filtering exists so a
user is not offered a destination that would refuse them — a courtesy, not a
boundary.

Two routes are deliberately unguarded because a single permission cannot
decide them: `/notifications` and, when it exists, anything else where the
platform filters per record rather than per endpoint. See
[FRONTEND.md](FRONTEND.md).

## Why this file is a pointer

The model has one implementation and needs one description. A second copy
drifts — as this one did — and a reader has no way to tell which copy is
current. The rule for this repository is that platform concepts are documented
where they are enforced.
