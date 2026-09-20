import { User, UserManager, WebStorageStateStore } from "oidc-client-ts";

const authority = import.meta.env.VITE_OIDC_AUTHORITY as string | undefined;
const clientId = import.meta.env.VITE_OIDC_CLIENT_ID as string | undefined;

export const oidcConfigured = Boolean(authority && clientId);

export const userManager = oidcConfigured
  ? new UserManager({
      authority: authority!,
      client_id: clientId!,
      redirect_uri: `${window.location.origin}/auth/callback`,
      post_logout_redirect_uri: window.location.origin,
      response_type: "code",
      scope: "openid profile email entitlements",
      loadUserInfo: true,
      userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    })
  : null;

export async function getUser(): Promise<User | null> {
  return userManager ? userManager.getUser() : null;
}

export async function login(): Promise<void> {
  if (!userManager) throw new Error("OIDC is not configured");
  await userManager.signinRedirect();
}

export async function completeLogin(): Promise<User> {
  if (!userManager) throw new Error("OIDC is not configured");
  return userManager.signinRedirectCallback();
}

export async function logout(): Promise<void> {
  if (!userManager) return;
  await userManager.signoutRedirect();
}

/**
 * Removes the locally stored OIDC user without a redirect (REM-17).
 *
 * Used when the platform has already rejected the token: the stored
 * credential is dead, so clearing app-level state alone (session.tsx's
 * `onUnauthenticated`) is not enough — without this, a reload's bootstrap
 * would find the same rejected user still in sessionStorage and hand it to
 * `/api/v1/me` again, failing the same way. This is not `logout()`: it does
 * not redirect to authentik and is not SLO, so a still-live authentik
 * browser session is left untouched — the user simply has to sign in again
 * through this app, deterministically, rather than silently retry a
 * credential the platform has already refused.
 */
export async function clearUser(): Promise<void> {
  if (!userManager) return;
  await userManager.removeUser();
}
