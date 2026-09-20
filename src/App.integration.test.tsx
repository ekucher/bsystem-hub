import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "oidc-client-ts";

/**
 * AppContent / application-level integration coverage (REM-9).
 *
 * App.test.tsx exercises AppRoutes with a Session supplied directly
 * (renderWithSession, src/test/render.tsx), which never mounts
 * SessionProvider or AppContent at all — that gap is exactly what PHASE 1.1's
 * corrected finding B2-1 identified (see .unlazy/audit/findings/B2.md).
 * session.test.tsx already pins the same SessionProvider/auth boundary at
 * the hook level (useSession's status/me/error), with no DOM involved.
 *
 * These tests render the real composition an actual page load goes through —
 * SessionProvider -> AppContent -> AppRoutes -> RequirePermission — with only
 * ./auth mocked (the same seam session.test.tsx already uses), and assert on
 * what a user actually sees: the loading announcement, the sign-in screen,
 * the routed application, a bootstrap failure, and a permission-guarded
 * route resolved through the real bootstrap flow rather than an injected
 * Session. This is materially different from App.test.tsx's coverage, not a
 * duplicate of it: nothing there exercises SessionProvider, AppContent, or
 * the real `./auth` module boundary.
 */

const auth = vi.hoisted(() => ({
  oidcConfigured: true,
  getUser: vi.fn(),
  completeLogin: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  clearUser: vi.fn(),
}));

vi.mock("./auth", () => auth);

// Imported after the mock is registered, so the whole module graph (App ->
// session -> auth) closes over the mock, exactly as session.test.tsx does.
const { default: App } = await import("./App");

type Me = import("./api/types").Me;

const ADMIN_PROFILE: Me = {
  id: "USR-000001",
  subject: "mock-admin",
  email: "admin@bsystem.example.invalid",
  name: "Mock Administrator",
  username: "mock-admin",
  groups: ["BSYSTEM-Admins"],
  roles: ["Administrator"],
  permissions: ["*"],
  modules: ["crm"],
};

const UNMAPPED_PROFILE: Me = {
  ...ADMIN_PROFILE,
  id: "USR-000008",
  name: "Mock Without Groups",
  username: "mock-no-groups",
  groups: [],
  roles: [],
  permissions: [],
  modules: [],
};

/** A signed-in user, as oidc-client-ts would hand one over. */
function signedIn(overrides: Partial<User> = {}): User {
  return { access_token: "token-abc", expired: false, ...overrides } as User;
}

/** Puts jsdom's real location on a path, as clicking a link would — App
 * renders a real BrowserRouter, not MemoryRouter, so this (not a `route`
 * render option) is how these tests choose the starting page. */
function navigateTo(path: string) {
  window.history.replaceState({}, "", path);
}

/** Answers every endpoint AppShell/Dashboard/NotificationsProvider touch on
 * an authenticated render, so a route-level test isn't tripped up by an
 * unrelated fetch it never asked about. Pass `me` to control /api/v1/me. */
function platformFetch(me: Me): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = (typeof input === "string" ? input : input.toString()).split("?")[0];
    if (url.endsWith("/api/v1/me")) {
      return new Response(JSON.stringify(me), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/api/v1/modules")) {
      return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/api/v1/notifications")) {
      return new Response(JSON.stringify({ data: [], pagination: { total: 0, limit: 0 }, unread_count: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ data: [], pagination: { total: 0, limit: 0 } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

beforeEach(() => {
  auth.oidcConfigured = true;
  auth.getUser.mockReset();
  auth.completeLogin.mockReset();
  auth.login.mockReset();
  auth.logout.mockReset();
  auth.clearUser.mockReset();
  navigateTo("/");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AppContent integration", () => {
  it("announces that the session is being checked, before anything else renders", () => {
    // Never resolves: this test only needs the synchronous "loading" render,
    // the same deliberate pattern used to fix this file's sibling act()
    // warning in App.test.tsx (see that file's "announces loading..." test).
    auth.getUser.mockReturnValue(new Promise<never>(() => {}));

    render(<App />);

    expect(screen.getByRole("status")).toHaveTextContent("перевірка сесії");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the sign-in screen, with the button enabled, for an anonymous visitor", async () => {
    auth.getUser.mockResolvedValue(null);

    render(<App />);

    const button = await screen.findByRole("button", { name: /Увійти/ });
    expect(button).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports the missing OIDC configuration and disables sign-in, rather than offering a button that cannot work", async () => {
    auth.oidcConfigured = false;

    render(<App />);

    const button = await screen.findByRole("button", { name: /Увійти/ });
    expect(button).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/VITE_OIDC_AUTHORITY/);
    // A deployment that cannot authenticate anyone never asks the platform
    // for a token in the first place.
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it("shows a bootstrap error rather than a blank screen when the platform rejects the profile", async () => {
    auth.getUser.mockResolvedValue(signedIn());
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "RBAC store unavailable" }), { status: 503 })),
    );

    render(<App />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/RBAC store unavailable/);
    // The user still has a next step — retry via a fresh sign-in — rather
    // than a dead end.
    expect(screen.getByRole("button", { name: /Увійти/ })).toBeInTheDocument();
  });

  it("renders the routed application, not the sign-in screen, once authenticated", async () => {
    auth.getUser.mockResolvedValue(signedIn());
    vi.stubGlobal("fetch", platformFetch(ADMIN_PROFILE));

    render(<App />);

    expect(await screen.findByText(`Вітаємо, ${ADMIN_PROFILE.name}`)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Увійти/ })).not.toBeInTheDocument();
  });

  // Materially different from App.test.tsx's "guards the user directory..."
  // test: that one supplies a Session directly and never touches
  // SessionProvider/AppContent. This one proves the same guard still holds
  // when reached through the real bootstrap -> RequirePermission chain.
  it("resolves a permission-guarded route to Forbidden through the real bootstrap, for a user the platform maps to nothing", async () => {
    navigateTo("/admin/users");
    auth.getUser.mockResolvedValue(signedIn());
    vi.stubGlobal("fetch", platformFetch(UNMAPPED_PROFILE));

    render(<App />);

    expect(await screen.findByRole("heading", { level: 1, name: "Немає доступу" })).toBeInTheDocument();
  });

  it("resolves the same guarded route to its page for a user the platform actually grants it to", async () => {
    navigateTo("/admin/users");
    auth.getUser.mockResolvedValue(signedIn());
    vi.stubGlobal(
      "fetch",
      (async (input: RequestInfo | URL) => {
        const url = (typeof input === "string" ? input : input.toString()).split("?")[0];
        if (url.endsWith("/api/v1/me")) {
          return new Response(JSON.stringify(ADMIN_PROFILE), { status: 200 });
        }
        if (url.endsWith("/api/v1/admin/accounts")) {
          return new Response(JSON.stringify({ management_available: true, accounts: [] }), { status: 200 });
        }
        if (url.endsWith("/api/v1/notifications")) {
          return new Response(JSON.stringify({ data: [], pagination: { total: 0, limit: 0 }, unread_count: 0 }), {
            status: 200,
          });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      }) as typeof fetch,
    );

    render(<App />);

    expect(await screen.findByRole("heading", { level: 1, name: "Користувачі" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Немає доступу" })).not.toBeInTheDocument();
  });

  // Exercises the real click path from AppShell's "Вийти" button through
  // useSession().signOut to auth.logout — not just that logout() itself
  // works (auth.test.ts already pins that at the unit level), but that the
  // rendered navigation is actually wired to it end to end.
  it("calls the real sign-out path when the rendered \"Вийти\" control is clicked", async () => {
    auth.getUser.mockResolvedValue(signedIn());
    vi.stubGlobal("fetch", platformFetch(ADMIN_PROFILE));

    render(<App />);
    await screen.findByText(`Вітаємо, ${ADMIN_PROFILE.name}`);

    fireEvent.click(screen.getByRole("button", { name: "Вийти" }));

    expect(auth.logout).toHaveBeenCalledTimes(1);
  });
});
