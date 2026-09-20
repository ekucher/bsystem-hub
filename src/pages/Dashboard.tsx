import { useSession } from "../session";
import { useResource } from "../hooks/useResource";
import { DataState } from "../components/DataState";
import { safeModuleLaunchUrl } from "../lib/moduleLaunchUrl";
import type { Module } from "../api/types";

const moduleIcons: Record<string, string> = {
  redmine: "R",
  outline: "O",
  crm: "C",
};

function ModuleIcon({ item }: { item: Module }) {
  const label = moduleIcons[item.icon ?? ""] ?? item.name.trim().charAt(0).toUpperCase() ?? "•";
  return (
    <span className="module-icon" aria-hidden="true">
      {label}
    </span>
  );
}

function ModuleCard({ item }: { item: Module }) {
  // Validated for protocol safety only (REM-3): javascript:/data:/file: and
  // malformed values are rejected before this ever reaches an anchor href.
  // Origin trust (which module origins should be allowed) is a separate,
  // still-open decision — see REM-3-ARCH.
  const href = safeModuleLaunchUrl(item.launch_url);

  const content = (
    <>
      <div className="module-card-header">
        <ModuleIcon item={item} />
        <div className="module-card-title">
          <h3>{item.name}</h3>
          <span className="module-card-id">{item.id}</span>
        </div>
      </div>
      <p>{item.description}</p>
      <span className="status">{item.status}</span>
    </>
  );

  if (!href) {
    return <li className="card">{content}</li>;
  }

  return (
    <li>
      <a className="card module-card-link" href={href} rel="noopener noreferrer">
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
          onRetry={modules.reload}
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
