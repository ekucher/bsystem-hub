# Contributing to the HUB

## Setup

Node 22 and npm.

```bash
npm ci
npm run dev
```

## Before you push

```bash
npm run typecheck
npm run lint      # see the note below
npm test -- --run
npm run build
npm audit --omit=dev --audit-level=moderate
```

**`npm run lint` does not exist yet, and that is recorded rather than hidden.**
`typescript-eslint` peers on `typescript >=4.8.4 <6.1.0` and this repository is
on TypeScript 7. Adding it means either forcing an unsupported resolution or
downgrading the compiler, and neither is worth it for a linter. `tsc --strict`,
the tests and the accessibility checks run instead. Tracked as blocked in
`TASKS.md` P8.

## The rule this repository exists under

**Authorization in the interface is presentation, not security.**

Navigation is filtered and routes are guarded by the permissions the platform
resolved, so a user is not offered a destination that would refuse them. That
is a courtesy. The Integration Core enforces authorization on every request and
would refuse the data even if this application rendered the page — and it is
tested to.

So: never reconstruct a platform decision locally, never treat a hidden link as
protection, and never reach an upstream system directly. If something you need
is not in the normalized contract, the fix is in the Integration Core.

## Accessibility

axe runs over every page in the suite. Before trusting a passing run, know its
limits: colour contrast cannot be evaluated in jsdom, and axe does not flag a
table stripped of its headers because it reads as a layout table. Both are
documented in `docs/FRONTEND.md`.

State is not carried by colour alone anywhere in this application, and a new
component should not be the first.

## Commits

Conventional Commit style, one coherent change per commit:

```text
feat: add normalized client detail endpoint
fix: normalize upstream timeout errors
test: add tenant isolation matrix
docs: document adapter retry policy
ci: add OpenAPI validation
refactor: extract authorization scope evaluator
security: fix a reachable vulnerability
chore: bump the Go toolchain
```

Not `misc changes`, `update files`, `fix stuff`, `wip`.

**The message body is where the reasoning goes.** A diff shows what changed; it
cannot show what else was considered, or what the change is protecting
against. If a commit's body seems long, read a few in the history and then try
reconstructing the same decision from the diff alone.

Never force-push a shared branch. Never rewrite published history.

## Releases and the changelog

The HUB publishes no package. It is a static bundle served by nginx, built
from a commit and shipped as a container image tagged with that SHA — so the
commit is the version, and the commit history is the changelog.

The design system it will eventually consume is versioned separately and
deliberately: see that repository's `docs/adr/ADR-011`. The HUB upgrades it
when somebody chooses to, which is the entire point of publishing it as a
package rather than consuming a branch.

## The rule that matters most

**Never weaken a check to get a green build.** Not a disabled test, not a
skipped lint rule, not a broadened allow-list, not a lowered severity
threshold.

A check exists because something went wrong once. Turning it off does not
remove the problem; it removes the only thing that would have told you about
the next one. If a check is wrong, fix the check and say why in the commit —
that is a change a reviewer can evaluate, which a silent exemption is not.

A finding that is genuinely a false positive gets the narrowest possible
remedy, scoped so it cannot mask anything else, with the reasoning written
down. There is a worked example in `bsystem-integration-core/.gitleaksignore`.

## When to stop and ask

Some work cannot be finished without a decision only the owner can make:

- real credentials, API keys or passwords
- production deployment, restart, DNS or TLS
- credential rotation
- destructive database operations
- a commercial commitment, such as an SLA target
- customer ownership that nobody has defined yet

For these, record a blocked entry in `TASKS.md` with what is needed, and move
to the next independent task. **A plausible default for one of these is worse
than a blocked task**, because a blocked task is visible and a guess is not:
an invented SLA target appears in front of a customer as a promise, and reads
exactly like a real one.
