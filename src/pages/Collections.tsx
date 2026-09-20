import { useState } from "react";
import { useSession } from "../session";
import { useResource } from "../hooks/useResource";
import { DataState } from "../components/DataState";
import { EntityTable, type Column } from "../components/EntityTable";
import type { Client, Collection, Document, Issue, Project } from "../api/types";

/**
 * A page listing one normalized collection.
 *
 * Paging is by the platform's opaque cursor. The page keeps the cursors it has
 * been given rather than computing offsets, because the encoding is an
 * implementation detail the HUB must not depend on.
 */
function CollectionPage<T extends { id: string }>({
  heading,
  path,
  caption,
  columns,
  detailPath,
  emptyMessage,
}: {
  heading: string;
  path: string;
  caption: string;
  columns: Column<T>[];
  detailPath?: (item: T) => string;
  emptyMessage: string;
}) {
  const { api } = useSession();
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors[cursors.length - 1];

  const state = useResource<Collection<T>>(
    (signal) => api.collection<T>(path, { signal, query: { cursor } }),
    [api, path, cursor],
  );

  return (
    <section aria-labelledby="collection-heading">
      <h1 id="collection-heading">{heading}</h1>
      <DataState
        state={state}
        onRetry={state.reload}
        isEmpty={(data) => data.data.length === 0}
        empty={<p>{emptyMessage}</p>}
      >
        {(data) => (
          <>
            <EntityTable caption={caption} columns={columns} items={data.data} detailPath={detailPath} />
            <nav className="pager" aria-label="Сторінки">
              <p className="muted" aria-live="polite">
                Показано {data.data.length} із {data.pagination.total}
              </p>
              <button type="button" onClick={() => setCursors((all) => all.slice(0, -1))} disabled={cursors.length === 0}>
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

export function Clients() {
  return (
    <CollectionPage<Client>
      heading="Клієнти"
      path="/api/v1/clients"
      caption="Клієнти, нормалізовані з CRM"
      emptyMessage="У CRM немає клієнтів."
      detailPath={(item) => `/clients/${item.id}`}
      columns={[
        { key: "name", header: "Назва", render: (item) => item.name },
        { key: "id", header: "Global ID", render: (item) => <code>{item.id}</code> },
        { key: "email", header: "Пошта", render: (item) => item.email ?? "—" },
        { key: "source", header: "Джерело", render: (item) => item.source },
      ]}
    />
  );
}

export function Projects() {
  return (
    <CollectionPage<Project>
      heading="Проєкти"
      path="/api/v1/projects"
      caption="Проєкти, нормалізовані з системи управління проєктами"
      emptyMessage="Немає проєктів."
      detailPath={(item) => `/projects/${item.id}`}
      columns={[
        { key: "name", header: "Назва", render: (item) => item.name },
        { key: "id", header: "Global ID", render: (item) => <code>{item.id}</code> },
        { key: "identifier", header: "Ідентифікатор", render: (item) => item.identifier },
        { key: "source", header: "Джерело", render: (item) => item.source },
      ]}
    />
  );
}

export function Issues() {
  return (
    <CollectionPage<Issue>
      heading="Задачі"
      path="/api/v1/issues"
      caption="Задачі, нормалізовані з системи управління проєктами"
      emptyMessage="Немає задач."
      columns={[
        { key: "subject", header: "Тема", render: (item) => item.subject },
        { key: "id", header: "Global ID", render: (item) => <code>{item.id}</code> },
        { key: "status", header: "Статус", render: (item) => item.status ?? "—" },
        {
          key: "project",
          header: "Проєкт",
          // An unmapped project is shown as absent rather than guessed at: a
          // missing mapping must never look like a relationship.
          render: (item) => (item.project_id ? <code>{item.project_id}</code> : "—"),
        },
      ]}
    />
  );
}

export function Documents() {
  return (
    <CollectionPage<Document>
      heading="Документи"
      path="/api/v1/documents"
      caption="Документи, нормалізовані з бази знань"
      emptyMessage="Немає документів."
      columns={[
        { key: "title", header: "Назва", render: (item) => item.title },
        { key: "id", header: "Global ID", render: (item) => <code>{item.id}</code> },
        { key: "collection", header: "Колекція", render: (item) => item.collection_id ?? "—" },
        { key: "updated", header: "Оновлено", render: (item) => item.updated_at ?? "—" },
      ]}
    />
  );
}
