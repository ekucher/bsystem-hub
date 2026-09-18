import { useSession } from "../session";
import { useResource } from "../hooks/useResource";
import { DataState } from "../components/DataState";
import type { Module } from "../api/types";

const moduleLinks: Record<string, string> = {
  redmine: "http://localhost:18103/",
  outline: "http://localhost:18101/",
};

function ModuleCard({ item }: { item: Module }) {
  const href = moduleLinks[item.id];

  const content = (
    <>
      <h3>{item.name}</h3>
      <p>{item.description}</p>
      <span className="status">{item.status}</span>
    </>
  );

  if (!href) {
    return <li className="card">{content}</li>;
  }

  return (
    <li>
      <a className="card module-card-link" href={href}>
        {content}
      </a>
    </li>
  );
}

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

      <section className="modules-section" aria-labelledby="modules-heading">
        <h2 id="modules-heading">Ваші модулі</h2>
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
                <ModuleCard key={item.id} item={item} />
              ))}
            </ul>
          )}
        </DataState>
      </section>
    </>
  );
}
