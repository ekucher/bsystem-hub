# HUB frontend

BSYSTEM HUB is the unified interface. It consumes the Integration Core's
normalized API and nothing else: no upstream system is contacted from the
browser, and no upstream field name reaches a component.

## Structure

```text
src/
├── api/        the client and the types mirroring the platform contract
├── components/ the shell, data states and the entity table
├── hooks/      resource loading with cancellation
├── pages/      one file per area
├── test/       render helpers, fixtures and the axe harness
├── auth.ts     the OIDC Authorization Code + PKCE flow
└── session.tsx the session, the resolved access, and the API client
```

## Routes

| Route | Requires |
| --- | --- |
| `/` | any authenticated user |
| `/profile` | any authenticated user |
| `/clients`, `/clients/:id` | `crm.client.read` |
| `/projects`, `/projects/:id` | `projects.task.read` |
| `/issues` | `projects.task.read` |
| `/documents` | `wiki.document.read` |
| `/notifications` | any authenticated user |
| `/403`, `/404`, anything else | — |

## Authorization is presentation only

Navigation is filtered, and guarded routes redirect to `/403`, by the
permissions the platform resolved for the user. **This is a courtesy to the
reader, not a security boundary.** The Integration Core enforces authorization
on every request and would refuse the data even if the HUB rendered the page.
A hidden link is never the reason something is protected.

## Notifications

`/notifications` is deliberately unguarded and its navigation entry is
deliberately unfiltered. Every other route maps to a single permission that
decides the whole page; a notification collection does not. What a user may
read is decided per notification by the Integration Core — a notification
naming their Global user ID, or addressed to a permission they hold — so any
permission check here could only disagree with that decision. See
`bsystem-integration-core/docs/NOTIFICATIONS.md`.

The unread badge reads the count from the collection envelope, which reports
it for the whole visible collection rather than for the page, so the HUB asks
for a single item. It is polled every 60 seconds: the platform has no channel
to the browser yet, and a badge that only updated on a full page reload would
be wrong for most of a working day. A failed poll leaves the previous count in
place and says nothing — a transient failure must not make unread
notifications look as though they have been dealt with, and the page the user
is actually reading reports its own failures.

Marking a notification read re-reads the collection instead of patching the
row. Read state is per user and lives on the platform; with the unread filter
on, the notification also leaves the collection, and the counts change for
reasons the page cannot compute.

A deep link is rendered only when the platform supplied one. It omits entity
types the HUB has no page for — servers, incidents, bugs, releases — and the
HUB does not construct one from the entity id, because a link that leads
nowhere is worse than no link.

## The API client

One client, in `src/api/client.ts`, is the only way the HUB talks to the
platform. Every request carries the bearer token and an `X-Request-ID`, so a
single identifier traces a user action through the platform, its adapters and
the audit trail.

Every failure arrives as a typed `ApiError` carrying the platform's stable
code, the failing source and the correlation id the platform reported — which
is the one worth showing a user who needs to report a problem.

Three distinctions the client makes so pages do not have to:

- **Cancellation is not failure.** Navigating away aborts the request, and no
  error is rendered on a page the user has already left. Without this, a user
  clicking through a list quickly can have a slower earlier response overwrite
  a later one and see the wrong record.
- **A rejected token ends the session; a forbidden response does not.** The
  first means sign in again, the second means this user may not do this.
- **A response that is not the platform's error shape still produces a usable
  message** — a proxy or gateway can answer with HTML.

## Data states

`DataState` renders loading, empty, error and unauthorized consistently.
The distinctions are deliberate: "you may not see this" is a different answer
from "there is nothing here", and "the source system is down" is different
again from "the platform is broken". Collapsing them into one message leaves a
user unable to tell whether to retry, to ask for access, or to wait.

## Pagination

Collections are paged by the platform's opaque cursor. The HUB keeps the
cursors it has been given and never constructs one, because the encoding is an
implementation detail that will change when a source system gains real
cursors.

## Accessibility

- A skip link is the first focusable element on every page.
- Focus is visibly ringed on every interactive element.
- One `h1` per page, with headings in order.
- Navigation is a labelled landmark; the current page is marked by weight and
  an underline as well as colour, so the distinction survives for a reader who
  cannot perceive the colour difference.
- Tables carry a caption and column headers, which screen readers announce.
- Loading is announced through a live region.

`npm test` runs axe over every page. Automated checks catch only a subset of
accessibility problems — colour contrast cannot be evaluated in jsdom at all,
and a table with no headers reads as a layout table rather than a violation —
but the subset they do catch is exactly the kind that regresses silently as
pages change.

## Linting

ESLint is not yet wired up. `typescript-eslint` — which supplies the only
maintained TypeScript parser for ESLint — declares a peer range of
`typescript >=4.8.4 <6.1.0`, and this project is on TypeScript 7. Adding it
would mean either forcing an unsupported resolution or downgrading the
compiler, and neither is worth doing to gain lint rules that `tsc --strict`
and the tests already cover most of. This is tracked in `TASKS.md` under P8.

## Development

```bash
npm install
npm run dev        # proxies /api to http://localhost:8080
npm run typecheck
npm test
npm run build
```
