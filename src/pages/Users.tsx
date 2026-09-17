import { useSession } from "../session";
import { useResource } from "../hooks/useResource";
import { DataState } from "../components/DataState";
import { EntityTable, type Column } from "../components/EntityTable";
import type { HumanIdentity } from "../api/types";

const COLUMNS: Column<HumanIdentity>[] = [
  {
    key: "name",
    header: "Користувач",
    render: (item) => item.display_name || item.username,
  },
  {
    key: "username",
    header: "Логін",
    render: (item) => <code>{item.username}</code>,
  },
  {
    key: "id",
    header: "Global ID",
    render: (item) => <code>{item.id}</code>,
  },
  {
    key: "email",
    header: "Пошта",
    render: (item) => item.email || "—",
  },
  {
    key: "groups",
    header: "Групи",
    render: (item) => (item.groups.length > 0 ? item.groups.join(", ") : "—"),
  },
  {
    key: "last-seen",
    header: "Останній вхід",
    render: (item) => <time dateTime={item.last_seen_at}>{item.last_seen_at}</time>,
  },
];

/**
 * The platform-owned human identity directory.
 *
 * It intentionally shows Integration Core state, not a second copy of the
 * authentik user database. A user appears here after their first successful
 * platform authentication, which is also when the immutable USR-* Global ID
 * is allocated.
 */
export function Users() {
  const { api } = useSession();
  const state = useResource<HumanIdentity[]>(
    (signal) => api.request<HumanIdentity[]>("/api/v1/admin/users", { signal }),
    [api],
  );

  return (
    <section aria-labelledby="users-heading">
      <h1 id="users-heading">Користувачі</h1>
      <p className="muted">
        Ідентичності, які вже автентифікувалися в BSYSTEM. Облікові дані та активація залишаються в authentik.
      </p>
      <DataState
        state={state}
        isEmpty={(users) => users.length === 0}
        empty={<p>Ще немає користувачів, які автентифікувалися в платформі.</p>}
      >
        {(users) => (
          <EntityTable
            caption="Користувачі BSYSTEM та їхні Global ID"
            columns={COLUMNS}
            items={users}
          />
        )}
      </DataState>
    </section>
  );
}
