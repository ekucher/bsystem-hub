# Global IDs

**The authoritative document is
[`bsystem-integration-core/docs/GLOBAL-IDS.md`](https://github.com/ekucher/bsystem-integration-core/blob/main/docs/GLOBAL-IDS.md).**

Global IDs are allocated and enforced by the Integration Core. The HUB neither
creates nor interprets them.

## What the HUB does with them

- Uses them as route parameters: `/clients/CL-000001`.
- Renders them, so a user can quote one when reporting a problem.
- Passes them back to the platform unchanged.

## What the HUB must not do

**Never parse one.** The prefix is not a type check and the number is not a
position. A page that inferred an entity type from a prefix would break the
moment the platform allocated a new one, and would do it silently.

**Never construct one.** Not by incrementing, not by padding, not by guessing.
Global IDs are sequential and therefore guessable, which is exactly why the
platform authorizes every one of them and answers a record you may not read
identically to one that does not exist. A HUB that constructed identifiers
would be probing, and would get nothing but 404s for its trouble.

**Never use one as evidence of access.** Holding a Global ID grants nothing.
