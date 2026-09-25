# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

BSYSTEM-HUB is the central user-facing portal/launcher for the BSYSTEM platform: auth hand-off, app navigation, dashboard aggregation, notifications, profile, RBAC-aware UI, deep links into connected modules (CRM/EspoCRM, Projects/Redmine, QA, Wiki/Outline, Operations). It does not replace those systems — see `README.md` for the full module list and P0 scope.

This repo is a **static frontend only** — React 19 + TypeScript + Vite, built to a bundle and served by nginx (`nginxinc/nginx-unprivileged`, see `Dockerfile`/`nginx.conf`). There is no backend, database, or cache here. All state is either the browser's own OIDC session (`sessionStorage`) or fetched live from Integration Core through nginx's `/api/` reverse-proxy location. Related repos: `ekucher/bsystem-integration-core` (the real backend/authorization engine), `ekucher/bsystem-design-system`, `ekucher/bsystem-deploy`.

## Commands

```bash
npm install
npm run dev             # vite dev server on :5173, proxies /api to http://localhost:8080
npm run typecheck       # tsc --noEmit (strict mode)
npm test                # vitest run — full suite once
npm run test:watch      # vitest watch mode
npm test -- src/session.test.tsx   # run a single test file
npm run build            # tsc --noEmit && vite build
```

Dev requires `VITE_OIDC_AUTHORITY` and `VITE_OIDC_CLIENT_ID` env vars (see `src/auth.ts`) — without both, the app renders a "not configured" error screen instead of a login button.

`npm run lint` does not exist and is intentionally not stubbed: `typescript-eslint` peers on TypeScript `>=4.8.4 <6.1.0`, and this repo is on TypeScript 7. `tsc --strict` + the test suite + axe accessibility checks cover most of what it would. Tracked as blocked in `TASKS.md` P8 — do not silently add a downgraded/forced ESLint setup to work around this.

Before pushing: `npm run typecheck && npm test -- --run && npm run build && npm audit --omit=dev --audit-level=moderate` (see `CONTRIBUTING.md`).

## The rule everything else follows from

**Authorization in this UI is presentation, not security.** Integration Core resolves permissions from authentik groups and enforces every request; this app only hides nav links and guards routes with the permission list Integration Core returned on `/api/v1/me`, so a user isn't offered a destination that would refuse them. Never reconstruct a platform authorization decision locally, never treat a hidden link as protection, and never call an upstream system (EspoCRM, Redmine, etc.) directly from the browser — if something isn't in the normalized `/api/v1` contract, the fix belongs in Integration Core. Full model: `docs/RBAC.md` (pointer to `bsystem-integration-core/docs/AUTHORIZATION.md`) and `docs/adr/ADR-005-central-sso-and-direct-module-access.md`.

SSO: authentik is the single interactive IdP for the whole ecosystem. Every interactive module (including this HUB) is an **independent** authentik OIDC client — HUB is a launcher, never a token broker, and HUB access/ID tokens must never be passed to a module. See `ADR-005` and `ADR-006` (launch-URL origin allowlist policy) in `docs/adr/`.

## Architecture

```text
src/
├── api/        client.ts (the only way this app talks to the platform) + types.ts
├── components/ AppShell (shell/nav), DataState (loading/empty/error/unauthorized), EntityTable, ErrorBoundary
├── hooks/      useResource.ts — resource loading with abort-on-unmount cancellation
├── pages/      one file per route/area
├── test/       render.tsx (renderWithSession + stubFetch fixtures), axe.ts, setup.ts
├── auth.ts     OIDC Authorization Code + PKCE flow (oidc-client-ts)
└── session.tsx SessionProvider: session state, resolved access, the ApiClient instance, can(permission)
```

### `src/api/client.ts` — the single API surface

Every request carries the bearer token and an `X-Request-ID` for cross-service tracing. Every failure becomes a typed `ApiError` (`status`, `code`, `source`, `requestId`) with helpers like `isForbidden`, `isNotFound`, `isUpstream`, `isNotConfigured`, `isRetryable`. Three behaviors baked in here so pages don't reimplement them:
- **Cancellation ≠ failure**: navigating away aborts the request via `AbortSignal`; no error renders on a page the user already left.
- **A rejected token (401) ends the session; a 403 does not** — the first means re-authenticate, the second means "not you."
- A non-JSON error body (e.g. an HTML page from a proxy) still produces a usable `ApiError`.

### `DataState` (`src/components/DataState.tsx`)

Every page renders loading/empty/error/forbidden through this one component rather than ad hoc conditionals — "you may not see this," "there's nothing here," "the source system is down," and "the platform is broken" are deliberately distinct messages, not collapsed into one.

### Routing & permissions (`src/App.tsx`, `src/components/AppShell.tsx`)

Routes are declared once in `App.tsx`; a guarded route wraps its element in `<RequirePermission permission="...">`, which redirects to `/403` when `useSession().can(permission)` is false. `AppShell`'s `NAV_ITEMS` list filters the same way — both must be kept in sync when adding a route with a permission. `/notifications` is deliberately **unguarded**: what a user may read there is decided per-notification by Integration Core (by recipient id or by permission), not by a single page-level permission, so no client-side check could agree with that decision correctly.

Module admin (`/admin/modules`, `src/pages/Modules.tsx`) manages the launcher catalog (name/description/icon/status/role visibility) via `/api/v1/admin/modules*` — this is catalog administration only, not SSO/OIDC client provisioning, which always happens directly in authentik (see ADR-005/ADR-006).

### Testing conventions

- `src/test/render.tsx` exports `renderWithSession(ui, { me, route, fetchImpl })` — renders with a `Session` supplied directly (no real OIDC/`SessionProvider`), and `stubFetch(routesByPath)` for path-keyed fixture responses. Most page/route tests use this.
- `src/App.integration.test.tsx` is the exception: it mounts the real `SessionProvider`/`AppContent`/bootstrap flow with only `./auth` mocked, to pin the boundary `renderWithSession` skips.
- `npm test` runs axe (`src/test/axe.ts`) over every page — catches missing landmarks/headers/labels, not colour contrast (unavailable in jsdom).

### Deployment

`Dockerfile` takes build-time `ARG`s `VITE_OIDC_AUTHORITY`/`VITE_OIDC_CLIENT_ID` (Vite env vars are baked in at build, not runtime) and produces a single nginx image; `nginx.conf` proxies `/api/` and serves `GET /healthz` as the liveness route (not `/health` — see `docs/ARCHITECTURE.md` for why that differs from the broader platform health contract). Image build/push and orchestration (Compose, TLS, DNS) live outside this repo, in the deploy pipeline.
