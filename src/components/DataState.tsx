import type { ReactNode } from "react";
import { ApiError } from "../api/client";
import type { ResourceState } from "../hooks/useResource";

/**
 * Renders the states a remote resource can be in, so every page presents
 * loading, empty, error and unauthorized the same way.
 *
 * The distinctions matter to the reader: "you may not see this" is a
 * different answer from "there is nothing here", and "the source system is
 * down" is different again from "the platform is broken". Collapsing them
 * into one "something went wrong" leaves a user unable to tell whether to
 * retry, to ask for access, or to wait.
 */
export function DataState<T>({
  state,
  children,
  empty,
  isEmpty,
}: {
  state: ResourceState<T>;
  children: (data: T) => ReactNode;
  /** Shown when the request succeeded but there is nothing to display. */
  empty?: ReactNode;
  isEmpty?: (data: T) => boolean;
}) {
  if (state.status === "loading") {
    return (
      <p className="state state-loading" role="status">
        Завантаження…
      </p>
    );
  }

  if (state.status === "error") {
    return <ErrorState error={state.error} />;
  }

  if (isEmpty?.(state.data)) {
    return <div className="state state-empty">{empty ?? <p>Немає даних для показу.</p>}</div>;
  }

  return <>{children(state.data)}</>;
}

export function ErrorState({ error }: { error: ApiError }) {
  return (
    <div className="state state-error" role="alert">
      <h2>{title(error)}</h2>
      <p>{error.message}</p>
      {error.source && <p className="muted">Джерельна система: {error.source}</p>}
      {error.requestId && (
        <p className="muted">
          Ідентифікатор запиту: <code>{error.requestId}</code>
        </p>
      )}
    </div>
  );
}

function title(error: ApiError): string {
  if (error.isForbidden) return "Немає доступу";
  if (error.isNotFound) return "Не знайдено";
  if (error.isUpstream) return "Джерельна система недоступна";
  if (error.isUnauthenticated) return "Сесія завершилася";
  return "Помилка";
}
