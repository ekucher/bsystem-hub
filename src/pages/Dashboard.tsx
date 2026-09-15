import { useSession } from "../session";
import { useResource } from "../hooks/useResource";
import { DataState } from "../components/DataState";
import type { Module } from "../api/types";

export function Dashboard() {
  const { api, me } = useSession();
  const modules = useResource((signal) => api.request<Module[]>("/api/v1/modules", { signal }), [api]);

  return (
    <>
      <section className="hero">
        <p className="eyebrow">BSYSTEM PLATFORM</p>
        <h1>Вітаємо, {me?.name || me?.username}</h1>
        <p>Доступ формується з груп authentik та RBAC-політик BSYSTEM.</p>
        <div className="identity-row">
          {me?.id && <span className="status">{me.id}</span>}
          {me?.roles.map((role) => (
            <span className="status role" key={role}>
              {role}
            </span>
          ))}
        </div>
      </section>

      <section aria-labelledby="modules-heading">
        <h2 id="modules-heading">Доступні модулі</h2>
        <DataState
          state={modules}
          isEmpty={(data) => data.length === 0}
          empty={
            <>
              <h3>Немає доступних модулів</h3>
              <p>Користувач автентифікований, але його групи ще не зіставлені з ролями BSYSTEM.</p>
            </>
          }
        >
          {(data) => (
            <ul className="grid" role="list">
              {data.map((item) => (
                <li className="card" key={item.id}>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <span className="status">{item.status}</span>
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </section>
    </>
  );
}
