import { Link, useParams } from "react-router-dom";
import { useSession } from "../session";
import { useResource } from "../hooks/useResource";
import { DataState } from "../components/DataState";
import type { Client, Project } from "../api/types";

/** Renders one normalized record, addressed by its platform Global ID. */
function DetailPage<T>({
  path,
  backTo,
  backLabel,
  render,
}: {
  path: (id: string) => string;
  backTo: string;
  backLabel: string;
  render: (item: T) => React.ReactNode;
}) {
  const { id = "" } = useParams();
  const { api } = useSession();
  const state = useResource<T>((signal) => api.request<T>(path(id), { signal }), [api, id]);

  return (
    <section>
      <p>
        <Link to={backTo}>← {backLabel}</Link>
      </p>
      <DataState state={state} onRetry={state.reload}>
        {(item) => render(item)}
      </DataState>
    </section>
  );
}

export function ClientDetail() {
  return (
    <DetailPage<Client>
      path={(id) => `/api/v1/clients/${encodeURIComponent(id)}`}
      backTo="/clients"
      backLabel="До списку клієнтів"
      render={(client) => (
        <>
          <h1>{client.name}</h1>
          <dl className="definitions">
            <dt>Global ID</dt>
            <dd>
              <code>{client.id}</code>
            </dd>
            <dt>Джерело</dt>
            <dd>
              {client.source} · <code>{client.source_id}</code>
            </dd>
            <dt>Пошта</dt>
            <dd>{client.email ?? "—"}</dd>
            <dt>Телефон</dt>
            <dd>{client.phone ?? "—"}</dd>
            <dt>Сайт</dt>
            <dd>{client.website ?? "—"}</dd>
          </dl>
        </>
      )}
    />
  );
}

export function ProjectDetail() {
  return (
    <DetailPage<Project>
      path={(id) => `/api/v1/projects/${encodeURIComponent(id)}`}
      backTo="/projects"
      backLabel="До списку проєктів"
      render={(project) => (
        <>
          <h1>{project.name}</h1>
          <dl className="definitions">
            <dt>Global ID</dt>
            <dd>
              <code>{project.id}</code>
            </dd>
            <dt>Джерело</dt>
            <dd>
              {project.source} · <code>{project.source_id}</code>
            </dd>
            <dt>Ідентифікатор</dt>
            <dd>{project.identifier}</dd>
            <dt>Опис</dt>
            <dd>{project.description ?? "—"}</dd>
          </dl>
        </>
      )}
    />
  );
}
