import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * How the HUB is configured to talk to authentik.
 *
 * Nothing here tests oidc-client-ts. What is pinned is the configuration this
 * application hands it, because those choices decide whether the browser flow
 * is the one the architecture calls for — Authorization Code with PKCE — and
 * they are invisible until a real identity provider rejects the request.
 *
 * The UserManager is constructed at module load from import.meta.env, so each
 * test resets the module registry and re-imports with the environment it wants.
 */

const UserManager = vi.hoisted(() => vi.fn());

vi.mock("oidc-client-ts", async () => {
  const actual = await vi.importActual<typeof import("oidc-client-ts")>("oidc-client-ts");
  return { ...actual, UserManager };
});

/** Loads auth.ts fresh with the given environment. */
async function loadAuth(env: Record<string, string | undefined>) {
  vi.resetModules();
  UserManager.mockClear();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) vi.stubEnv(key, "");
    else vi.stubEnv(key, value);
  }
  return import("./auth");
}

const CONFIGURED = {
  VITE_OIDC_AUTHORITY: "https://id.bsystem.example.invalid/application/o/bsystem/",
  VITE_OIDC_CLIENT_ID: "bsystem-hub",
};

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("the OIDC client configuration", () => {
  it("asks for an authorization code, which is what makes PKCE possible", async () => {
    await loadAuth(CONFIGURED);

    const config = UserManager.mock.calls[0][0];
    // The implicit flow returns a token in the URL fragment, where it reaches
    // the browser's history and every script on the page. The architecture
    // requires the code flow, and this is the line that decides it.
    expect(config.response_type).toBe("code");
    expect(config.authority).toBe(CONFIGURED.VITE_OIDC_AUTHORITY);
    expect(config.client_id).toBe(CONFIGURED.VITE_OIDC_CLIENT_ID);
  });

  it("carries no client secret, because a browser cannot keep one", async () => {
    await loadAuth(CONFIGURED);

    const config = UserManager.mock.calls[0][0];
    // A secret shipped to a browser is published. PKCE exists so a public
    // client needs none; a config that grew one would be a leak, not a fix.
    expect(config).not.toHaveProperty("client_secret");
  });

  it("returns to a callback path on this origin and nowhere else", async () => {
    await loadAuth(CONFIGURED);

    const config = UserManager.mock.calls[0][0];
    expect(config.redirect_uri).toBe(`${window.location.origin}/auth/callback`);
    expect(config.post_logout_redirect_uri).toBe(window.location.origin);
    // A redirect target derived from anything but the current origin is how an
    // authorization code is delivered to somebody else.
    expect(config.redirect_uri.startsWith(window.location.origin)).toBe(true);
  });

  it("keeps the session in sessionStorage, so it ends with the tab", async () => {
    await loadAuth(CONFIGURED);

    const config = UserManager.mock.calls[0][0];
    expect(config.userStore).toBeDefined();
    // WebStorageStateStore keeps the store it was given. localStorage would
    // outlive the browsing session on a shared machine.
    expect(config.userStore._store).toBe(window.sessionStorage);
  });

  it("asks for the claims the platform maps to an identity, and no more", async () => {
    await loadAuth(CONFIGURED);

    const config = UserManager.mock.calls[0][0];
    expect(config.scope).toBe("openid profile email entitlements");
    expect(config.loadUserInfo).toBe(true);
  });
});

describe("clearUser (REM-17)", () => {
  // Distinct from logout(): a rejected token must be removed locally
  // without redirecting to authentik, since there is nothing wrong with the
  // authentik session itself — only the token the HUB was holding.
  it("removes the stored user without redirecting", async () => {
    const removeUser = vi.fn().mockResolvedValue(undefined);
    const signoutRedirect = vi.fn();
    UserManager.mockImplementationOnce(function UserManagerStub() {
      return { removeUser, signoutRedirect };
    });

    const auth = await loadAuth(CONFIGURED);
    await auth.clearUser();

    expect(removeUser).toHaveBeenCalledTimes(1);
    expect(signoutRedirect).not.toHaveBeenCalled();
  });

  it("does nothing when OIDC is not configured, rather than throwing", async () => {
    const auth = await loadAuth({ VITE_OIDC_AUTHORITY: undefined, VITE_OIDC_CLIENT_ID: undefined });
    await expect(auth.clearUser()).resolves.toBeUndefined();
  });
});

describe("a deployment with no OIDC settings", () => {
  it("is reported as unconfigured rather than half-configured", async () => {
    const auth = await loadAuth({ VITE_OIDC_AUTHORITY: undefined, VITE_OIDC_CLIENT_ID: undefined });

    expect(auth.oidcConfigured).toBe(false);
    expect(auth.userManager).toBeNull();
    // Constructing a UserManager against an empty authority would produce a
    // sign-in button that redirects nowhere.
    expect(UserManager).not.toHaveBeenCalled();
  });

  it.each([
    ["only an authority", { ...CONFIGURED, VITE_OIDC_CLIENT_ID: undefined }],
    ["only a client id", { ...CONFIGURED, VITE_OIDC_AUTHORITY: undefined }],
  ])("treats %s as not configured at all", async (_name, env) => {
    const auth = await loadAuth(env);

    expect(auth.oidcConfigured).toBe(false);
    expect(UserManager).not.toHaveBeenCalled();
  });

  // Signing in is the one operation that cannot degrade quietly: a caller that
  // gets a resolved promise believes a redirect is under way and stops.
  it("refuses to pretend a sign-in is under way", async () => {
    const auth = await loadAuth({ VITE_OIDC_AUTHORITY: undefined, VITE_OIDC_CLIENT_ID: undefined });

    await expect(auth.login()).rejects.toThrow(/not configured/i);
    await expect(auth.completeLogin()).rejects.toThrow(/not configured/i);
    expect(await auth.getUser()).toBeNull();
  });

  // Signing out is the exception, and deliberately so: someone trying to end a
  // session they cannot have must never be handed an error to dismiss.
  it("lets a sign-out succeed, since there is nothing to end", async () => {
    const auth = await loadAuth({ VITE_OIDC_AUTHORITY: undefined, VITE_OIDC_CLIENT_ID: undefined });

    await expect(auth.logout()).resolves.toBeUndefined();
  });
});
