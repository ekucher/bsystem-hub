import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { RequestCancelled } from "./api/client";
import { useSession } from "./session";
import type { NotificationCollection } from "./api/types";

type NotificationsValue = {
  /** Unread notifications visible to this user, across the whole collection. */
  unreadCount: number;
  /** Re-reads the count. Called after the user marks something read. */
  refresh: () => void;
};

const NotificationsContext = createContext<NotificationsValue>({ unreadCount: 0, refresh: () => {} });

export function useNotifications(): NotificationsValue {
  return useContext(NotificationsContext);
}

/** How often the badge re-reads the count. */
export const DEFAULT_POLL_MS = 60_000;

/**
 * Keeps the unread count for the navigation badge.
 *
 * The count is read from the collection envelope with the smallest page the
 * API will serve, because the platform reports it for the whole visible
 * collection rather than for the page. Asking for one item is enough.
 *
 * It is polled rather than pushed. The platform has no channel to the browser
 * yet, and a badge that only updates on a full page reload would be wrong for
 * most of a working day. A failed poll is deliberately silent: an unreachable
 * count is not something to interrupt the user about, and the page they are
 * actually reading will report the failure itself.
 */
export function NotificationsProvider({
  children,
  pollMs = DEFAULT_POLL_MS,
}: {
  children: ReactNode;
  pollMs?: number;
}) {
  const { api, status } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [attempt, setAttempt] = useState(0);
  // Kept in a ref so the polling effect does not restart on every refresh.
  const active = useRef(true);

  const refresh = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (status !== "authenticated") {
      setUnreadCount(0);
      return;
    }
    active.current = true;
    const controller = new AbortController();

    const read = () => {
      api
        .request<NotificationCollection>("/api/v1/notifications", {
          signal: controller.signal,
          query: { limit: 1 },
        })
        .then((page) => {
          if (active.current) setUnreadCount(page.unread_count);
        })
        .catch((cause: unknown) => {
          if (cause instanceof RequestCancelled) return;
          // Leave the previous count in place: a transient failure should not
          // make unread notifications appear to have been dealt with.
        });
    };

    read();
    const timer = pollMs > 0 ? window.setInterval(read, pollMs) : undefined;
    return () => {
      active.current = false;
      controller.abort();
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [api, status, attempt, pollMs]);

  const value = useMemo(() => ({ unreadCount, refresh }), [unreadCount, refresh]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
