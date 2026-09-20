import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiClient } from "./api/client";
import type { Me } from "./api/types";
import { clearUser, completeLogin, getUser, login, logout, oidcConfigured } from "./auth";

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

  // Tracks an in-flight "end the session" attempt so concurrent 401s from
  // several simultaneously in-flight requests share one clearUser() call and
  // one deterministic completion, rather than each racing its own (REM-17
  // correction, item 1 concurrency requirement).
  const endingSessionRef = useRef<Promise<void> | null>(null);

  const api = useMemo(
    () =>
      new ApiClient({
        getToken: async () => (await getUser())?.access_token ?? null,
        // A rejected token means the stored session is no longer usable.
        // REM-17 correction: removing the stored OIDC user is now a
        // deterministic, awaited part of ending the session, not a
        // fire-and-forget side effect — ApiClient.request() awaits this
        // callback before its own promise settles, so a caller that awaits a
        // 401'd request is guaranteed the rejected credential has already
        // been removed by the time it observes the failure, and the
        // in-memory session has already flipped to anonymous. Deliberately
        // not logout()/SLO — see auth.ts's clearUser().
        onUnauthenticated: () => {
          if (!endingSessionRef.current) {
            endingSessionRef.current = (async () => {
              try {
                await clearUser();
              } finally {
                setMe(null);
                setStatus("anonymous");
                endingSessionRef.current = null;
              }
            })();
          }
          return endingSessionRef.current;
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
          try {
            await completeLogin();
          } finally {
            // The code leaves the URL whether or not the exchange succeeded.
            // On failure it may never have been spent — oidc-client-ts rejects
            // a state mismatch before it contacts the provider — so it can
            // still be a live credential, and it would otherwise sit in the
            // address bar, in the browser's history and in anything the user
            // copies from there. Reloading would also retry an exchange that
            // cannot succeed, turning one failure into a loop.
            window.history.replaceState({}, document.title, "/");
          }
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
