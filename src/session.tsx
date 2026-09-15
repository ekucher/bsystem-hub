import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiClient } from "./api/client";
import type { Me } from "./api/types";
import { completeLogin, getUser, login, logout, oidcConfigured } from "./auth";

/** Where the session is in its lifecycle. */
export type SessionStatus = "loading" | "anonymous" | "authenticated" | "error";

export type Session = {
  status: SessionStatus;
  /** The authenticated user, once the platform has resolved their access. */
  me: Me | null;
  /** Why the session could not be established, when status is "error". */
  error: string | null;
  /** Whether the deployment has OIDC configured at all. */
  configured: boolean;
  api: ApiClient;
  signIn: () => void;
  signOut: () => void;
  /** True when the user's resolved access includes the permission. */
  can: (permission: string) => boolean;
};

const SessionContext = createContext<Session | null>(null);

/** Reads the session. Throws outside a provider rather than returning a null
 * every caller would have to check. */
export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside a SessionProvider");
  return session;
}

/** Exported for tests, which supply a session directly. */
export const SessionProviderContext = SessionContext;

/** Returns whether a resolved access set includes a permission. `*` is the
 * administrator wildcard, matching the platform's own evaluation. */
export function hasPermission(me: Me | null, permission: string): boolean {
  if (!me) return false;
  return me.permissions.includes("*") || me.permissions.includes(permission);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const api = useMemo(
    () =>
      new ApiClient({
        getToken: async () => (await getUser())?.access_token ?? null,
        // A rejected token means the stored session is no longer usable.
        // Clearing it locally puts the user back on the sign-in screen rather
        // than on a page that can never load.
        onUnauthenticated: () => {
          setMe(null);
          setStatus("anonymous");
        },
      }),
    [],
  );

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!oidcConfigured) {
        if (active) {
          setStatus("error");
          setError("OIDC ще не налаштований. Вкажіть VITE_OIDC_AUTHORITY та VITE_OIDC_CLIENT_ID.");
        }
        return;
      }

      try {
        if (window.location.pathname === "/auth/callback") {
          await completeLogin();
          window.history.replaceState({}, document.title, "/");
        }

        const user = await getUser();
        if (!user || user.expired) {
          if (active) setStatus("anonymous");
          return;
        }

        const profile = await api.request<Me>("/api/v1/me");
        if (!active) return;
        setMe(profile);
        setStatus("authenticated");
      } catch (cause) {
        if (!active) return;
        setStatus("error");
        setError(cause instanceof Error ? cause.message : "Не вдалося встановити сесію");
      }
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, [api]);

  const value = useMemo<Session>(
    () => ({
      status,
      me,
      error,
      configured: oidcConfigured,
      api,
      signIn: () => void login(),
      signOut: () => void logout(),
      can: (permission: string) => hasPermission(me, permission),
    }),
    [status, me, error, api],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
