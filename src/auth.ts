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
      scope: "openid profile email",
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
