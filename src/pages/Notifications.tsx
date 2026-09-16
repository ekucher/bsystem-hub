import { useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../session";
import { useNotifications } from "../notifications";
import { useResource } from "../hooks/useResource";
import { DataState } from "../components/DataState";
import type { Notification, NotificationCollection } from "../api/types";

/** Severity, rendered in Ukrainian with a shape as well as a colour. */
const SEVERITY: Record<Notification["severity"], { label: string; mark: string }> = {
  debug: { label: "Налагодження", mark: "·" },
  info: { label: "Інформація", mark: "i" },
  warning: { label: "Попередження", mark: "!" },
  error: { label: "Помилка", mark: "×" },
  critical: { label: "Критично", mark: "!!" },
};

function formatMoment(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

/**
 * The notification centre.
 *
 * The page shows what the platform returned and nothing else. It does not
 * filter by permission: the Integration Core resolves the caller's audience
 * and returns only what they may read, so any filtering here could only
 * disagree with that decision.
 */
export function Notifications() {
  const { api } = useSession();
  const { refresh } = useNotifications();
  const [cursors, setCursors] = useState<string[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [marking, setMarking] = useState<number | null>(null);
  const cursor = cursors[cursors.length - 1];

  const state = useResource<NotificationCollection>(
    (signal) =>
      api.request<NotificationCollection>("/api/v1/notifications", {
        signal,
        query: { cursor, unread: unreadOnly ? "true" : undefined },
      }),
    [api, cursor, unreadOnly],
  );

  const markRead = async (id: number) => {
    setMarking(id);
    try {
      await api.request<void>(`/api/v1/notifications/${id}/read`, { method: "POST" });
      // Re-read rather than patching the row in place: with the unread filter
      // on, the notification leaves the collection, and the counts change for
      // reasons this page cannot compute.
      state.reload();
      refresh();
    } finally {
      setMarking(null);
    }
  };

  return (
    <section aria-labelledby="notifications-heading">
      <h1 id="notifications-heading">Сповіщення</h1>
      <p className="muted">
        Сповіщення адресуються особисто або за дозволом. Що саме ви бачите, вирішує Integration Core.
      </p>

      <label className="filter">
        <input
          type="checkbox"
          checked={unreadOnly}
          onChange={(event) => {
            setUnreadOnly(event.target.checked);
            setCursors([]);
          }}
        />
        Лише непрочитані
      </label>

      <DataState
        state={state}
        isEmpty={(data) => data.data.length === 0}
        empty={<p>{unreadOnly ? "Непрочитаних сповіщень немає." : "Сповіщень немає."}</p>}
      >
        {(data) => (
          <>
            <ul className="notification-list" aria-label="Список сповіщень">
              {data.data.map((item) => (
                <li key={item.id} className={item.read ? "notification read" : "notification unread"}>
                  <article aria-labelledby={`notification-${item.id}-title`}>
                    <p className={`severity severity-${item.severity}`}>
                      <span aria-hidden="true">{SEVERITY[item.severity]?.mark ?? "·"}</span>{" "}
                      {SEVERITY[item.severity]?.label ?? item.severity}
                      {!item.read && <span className="unread-dot"> · Непрочитане</span>}
                    </p>
                    <h2 id={`notification-${item.id}-title`}>{item.title}</h2>
                    {item.body && <p>{item.body}</p>}
                    <p className="muted">
                      <time dateTime={item.occurred_at}>{formatMoment(item.occurred_at)}</time>
                      {" · "}
                      {item.event}
                      {item.entity_id && (
                        <>
                          {" · "}
                          <code>{item.entity_id}</code>
                        </>
                      )}
                    </p>
                    <p className="row-actions">
                      {/* A deep link is offered only when the platform gave
                          one: it omits entity types the HUB has no page for,
                          and a link that leads nowhere is worse than none. */}
                      {item.deep_link && <Link to={item.deep_link}>Відкрити</Link>}
                      {!item.read && (
                        <button
                          type="button"
                          className="link-button"
                          disabled={marking === item.id}
                          onClick={() => void markRead(item.id)}
                        >
                          Позначити прочитаним
                        </button>
                      )}
                    </p>
                  </article>
                </li>
              ))}
            </ul>

            <nav className="pager" aria-label="Сторінки">
              <p className="muted" aria-live="polite">
                Показано {data.data.length} із {data.pagination.total} · непрочитаних {data.unread_count}
              </p>
              <button
                type="button"
                onClick={() => setCursors((all) => all.slice(0, -1))}
                disabled={cursors.length === 0}
              >
                Назад
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = data.pagination.next_cursor;
                  if (next) setCursors((all) => [...all, next]);
                }}
                disabled={!data.pagination.next_cursor}
              >
                Далі
              </button>
            </nav>
          </>
        )}
      </DataState>
    </section>
  );
}
