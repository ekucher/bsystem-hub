import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "oidc-client-ts";

/**
 * The session lifecycle — how the HUB decides whether somebody is signed in,
 * what it does with an authorization code, and what happens when the platform
 * stops accepting a token.
 *
 * This is the part of the HUB with the most security weight and it had no
 * coverage at all: everything here was first executed in a browser against a
 * real authentik. The OIDC library is mocked, because what is worth pinning is
 * not that oidc-client-ts works — it is what this application does with what
 * the library returns.
 *
 * Note the deliberate asymmetry with the platform: nothing asserted here is a
 * security boundary. The backend authorizes every request regardless of what
 * the HUB believes. These tests pin that the HUB does not *mislead* a user
 * about their own session, which is a correctness property, not a defence.
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

// Imported after the mock is registered, so the provider closes over it.
const { SessionProvider, useSession, hasPermission } = await import("./session");
type Me = import("./api/types").Me;

const PROFILE: Me = {
  id: "USR-000001",
  subject: "mock-admin",
  email: "admin@bsystem.example.invalid",
  name: "Mock Administrator",
  username: "mock-admin",
  groups: ["BSYSTEM-Admins"],
  roles: ["Administrator"],
  permissions: ["crm.client.read"],
  modules: ["crm"],
};

/** A signed-in user, as oidc-client-ts would hand one over. */
function signedIn(overrides: Partial<User> = {}): User {
  return { access_token: "token-abc", expired: false, ...overrides } as User;
}

/** Renders the provider and reports the session it produces. */
function Probe() {
  const session = useSession();
  return (
    <div>
      <span data-testid="status">{session.status}</span>
      <span data-testid="error">{session.error ?? ""}</span>
      <span data-testid="me">{session.me?.id ?? ""}</span>
      <span data-testid="can">{String(session.can("crm.client.read"))}</span>
    </div>
  );
}

function renderSession() {
  return render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  );
}

/** Puts the browser on a path without reloading, as the router would. */
function navigateTo(path: string) {
  window.history.replaceState({}, "", path);
}

beforeEach(() => {
  auth.oidcConfigured = true;
  auth.getUser.mockReset();
  auth.completeLogin.mockReset();
  auth.login.mockReset();
  auth.logout.mockReset();
  auth.clearUser.mockReset();
  navigateTo("/");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(PROFILE), { status: 200 })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("establishing a session", () => {
  it("resolves the caller's access from the platform, not from the token", async () => {
    auth.getUser.mockResolvedValue(signedIn());

    renderSession();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("me")).toHaveTextContent("USR-000001");
    // The permissions came from /api/v1/me. A token that merely parses is not
    // a session: only the platform knows what its bearer may do.
    expect(screen.getByTestId("can")).toHaveTextContent("true");
  });

  it("treats no stored user as anonymous rather than as a failure", async () => {
    auth.getUser.mockResolvedValue(null);

    renderSession();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    expect(screen.getByTestId("error")).toHaveTextContent("");
  });

  // An expired token is not a session. Treating one as authenticated would put
  // a user on a page whose every request then fails, with no way back to the
  // sign-in screen.
  it("treats an expired user as anonymous, never as authenticated", async () => {
    auth.getUser.mockResolvedValue(signedIn({ expired: true }));

    renderSession();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    expect(screen.getByTestId("me")).toHaveTextContent("");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  // A deployment with no OIDC settings cannot sign anyone in. Reporting that
  // as "anonymous" would show a sign-in button that can never work; the
  // operator needs to be told what is missing.
  it("says so when the deployment has no OIDC configured", async () => {
    auth.oidcConfigured = false;

    renderSession();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    expect(screen.getByTestId("error")).toHaveTextContent("VITE_OIDC_AUTHORITY");
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it("reports a platform that refuses the profile as an error, not as anonymous", async () => {
    auth.getUser.mockResolvedValue(signedIn());
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "RBAC store unavailable" }), { status: 503 })),
    );

    renderSession();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
  });
});

describe("returning from the identity provider", () => {
  it("completes the exchange and takes the authorization code out of the URL", async () => {
    navigateTo("/auth/callback?code=secret-authorization-code&state=xyz");
    auth.completeLogin.mockResolvedValue(signedIn());
    auth.getUser.mockResolvedValue(signedIn());

    renderSession();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(auth.completeLogin).toHaveBeenCalledOnce();
    // An authorization code left in the address bar is copied into bookmarks,
    // shared links and the browser's history, and is offered back to the
    // provider on a reload.
    expect(window.location.search).toBe("");
    expect(window.location.pathname).toBe("/");
  });

  it("does not run the exchange on an ordinary page load", async () => {
    auth.getUser.mockResolvedValue(signedIn());

    renderSession();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(auth.completeLogin).not.toHaveBeenCalled();
  });

  // The case worth pinning, because it is the one that is easy to get wrong:
  // when the exchange fails, the code must still leave the URL. It may never
  // have been spent — oidc-client-ts rejects a state mismatch before it
  // contacts the provider — so it can still be a live credential sitting in
  // the address bar and in the browser's history. Reloading would also retry
  // an exchange that cannot succeed, turning one failure into a loop.
  it("takes the code out of the URL even when the exchange fails", async () => {
    navigateTo("/auth/callback?code=secret-authorization-code&state=xyz");
    auth.completeLogin.mockRejectedValue(new Error("state mismatch"));

    renderSession();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    expect(window.location.search).toBe("");
  });

  it("explains a failed exchange rather than leaving the user on a blank screen", async () => {
    navigateTo("/auth/callback?code=abc&state=xyz");
    auth.completeLogin.mockRejectedValue(new Error("state mismatch"));

    renderSession();

    await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("state mismatch"));
  });
});

describe("losing a session", () => {
  // The platform is the authority on whether a token is still good. When it
  // says no, the HUB has to agree locally — otherwise the user sits on a page
  // that looks signed in and answers nothing.
  it("ends the local session when the platform rejects the token", async () => {
    auth.getUser.mockResolvedValue(signedIn());
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(PROFILE), { status: 200 }))
      .mockResolvedValue(new Response(JSON.stringify({ error: "invalid token" }), { status: 401 }));
    vi.stubGlobal("fetch", fetchImpl);

    function Reloader() {
      const session = useSession();
      return (
        <div>
          <span data-testid="status">{session.status}</span>
          <span data-testid="me">{session.me?.id ?? ""}</span>
          <button
            onClick={() => {
              void session.api.request("/api/v1/clients").catch(() => undefined);
            }}
          >
            reload
          </button>
        </div>
      );
    }

    render(
      <SessionProvider>
        <Reloader />
      </SessionProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    screen.getByRole("button").click();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    // The resolved access has to go with it. Leaving it behind would let the
    // UI keep offering actions the platform has stopped accepting.
    expect(screen.getByTestId("me")).toHaveTextContent("");
  });

  // REM-17 correction (race removed): clearUser() must be a deterministic
  // part of 401 handling, not a fire-and-forget side effect racing the UI
  // transition. ApiClient.request() now awaits onUnauthenticated, so by the
  // time an awaited 401'd request settles, both the stored OIDC user removal
  // and the in-memory anonymous transition are guaranteed to have already
  // happened — proven here without any `waitFor` polling for status, because
  // it must already be true synchronously after the await.
  it("A+B. removes the stored OIDC user and reaches anonymous deterministically, by the time the 401'd request itself settles", async () => {
    auth.getUser.mockResolvedValue(signedIn());
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(PROFILE), { status: 200 }))
      .mockResolvedValue(new Response(JSON.stringify({ error: "invalid token" }), { status: 401 }));
    vi.stubGlobal("fetch", fetchImpl);

    let session: ReturnType<typeof useSession> | null = null;
    function Probe2() {
      session = useSession();
      return <span data-testid="status">{session.status}</span>;
    }

    render(
      <SessionProvider>
        <Probe2 />
      </SessionProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(auth.clearUser).not.toHaveBeenCalled();

    // act() flushes the state updates React scheduled once this settles —
    // no waitFor/polling needed, because both effects are required to have
    // completed by now: ApiClient awaited onUnauthenticated before this
    // promise itself settled.
    await act(async () => {
      await session!.api.request("/api/v1/clients").catch(() => undefined);
    });

    expect(auth.clearUser).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("status")).toHaveTextContent("anonymous");
  });

  // C. "subsequent bootstrap cannot reuse the rejected User" is proven by
  // composition rather than re-simulated end to end in this fully-mocked
  // file: auth.test.ts's "clearUser (REM-17)" test proves clearUser() really
  // calls the underlying userManager.removeUser() (the actual storage
  // removal), and the test above proves that real call is awaited to
  // completion before 401 handling is considered finished. Together they
  // guarantee a subsequent bootstrap's getUser() reads storage only after
  // the rejected credential has actually been removed from it.

  // D. Two requests in flight at once both hit 401. clearUser must run once
  // (not once per request), both callers must resolve without the dedup
  // mechanism itself throwing, and a later, independent 401 must still
  // trigger its own clearUser call — the guard resets after each completed
  // cycle rather than latching permanently.
  it("D. handles concurrent and repeated 401 responses safely: clearUser runs once per cycle, never re-latched", async () => {
    auth.getUser.mockResolvedValue(signedIn());
    // A fresh Response per call: two concurrent requests must not be handed
    // the same Response instance, whose body can only be read once.
    let firstCall = true;
    const fetchImpl = vi.fn(async () => {
      if (firstCall) {
        firstCall = false;
        return new Response(JSON.stringify(PROFILE), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "invalid token" }), { status: 401 });
    });
    vi.stubGlobal("fetch", fetchImpl);

    let session: ReturnType<typeof useSession> | null = null;
    function Probe3() {
      session = useSession();
      return <span data-testid="status">{session.status}</span>;
    }

    render(
      <SessionProvider>
        <Probe3 />
      </SessionProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    let firstResult: unknown;
    let secondResult: unknown;
    await act(async () => {
      const first = session!.api.request("/api/v1/clients").catch(() => "first-failed");
      const second = session!.api.request("/api/v1/projects").catch(() => "second-failed");
      [firstResult, secondResult] = await Promise.all([first, second]);
    });

    expect(firstResult).toBe("first-failed");
    expect(secondResult).toBe("second-failed");
    expect(auth.clearUser).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("status")).toHaveTextContent("anonymous");

    // A later, independent 401 is a new cycle and must still clear the user.
    await act(async () => {
      await session!.api.request("/api/v1/issues").catch(() => undefined);
    });
    expect(auth.clearUser).toHaveBeenCalledTimes(2);
  });

  it("carries the token the identity provider issued, and only that", async () => {
    auth.getUser.mockResolvedValue(signedIn({ access_token: "token-abc" }));
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify(PROFILE), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchImpl);

    renderSession();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    const headers = new Headers(fetchImpl.mock.calls[0][1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-abc");
    // Correlation is what ties a user's report back to the platform's audit
    // trail, so it must be on the very first request, not only on later ones.
    expect(headers.get("X-Request-ID")).toBeTruthy();
  });
});

describe("hasPermission", () => {
  // This mirrors the platform's own evaluation: authz.PermissionAll is "*".
  // If the two ever disagree, the UI offers actions the backend refuses, or
  // hides ones it would allow.
  it("grants an administrator everything through the wildcard", () => {
    const admin = { ...PROFILE, permissions: ["*"] };
    expect(hasPermission(admin, "crm.client.read")).toBe(true);
    expect(hasPermission(admin, "anything.at.all")).toBe(true);
  });

  it("grants exactly what is listed and nothing adjacent", () => {
    const user = { ...PROFILE, permissions: ["crm.client.read"] };
    expect(hasPermission(user, "crm.client.read")).toBe(true);
    expect(hasPermission(user, "crm.client.write")).toBe(false);
    expect(hasPermission(user, "crm.client")).toBe(false);
    expect(hasPermission(user, "crm.client.read.extra")).toBe(false);
  });

  // Deny by default, the platform's first rule. An unmapped user — one whose
  // groups match no role — holds nothing, and no permission is a wildcard.
  it("grants nothing to a user with no permissions and nothing to no user", () => {
    expect(hasPermission({ ...PROFILE, permissions: [] }, "crm.client.read")).toBe(false);
    expect(hasPermission(null, "crm.client.read")).toBe(false);
    expect(hasPermission(null, "*")).toBe(false);
  });
});

describe("useSession", () => {
  // Returning a null outside a provider would make every caller write a check
  // it would eventually forget, and the forgotten one renders as if signed out.
  it("refuses to be used outside a provider rather than returning nothing", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(/SessionProvider/);
    quiet.mockRestore();
  });
});
