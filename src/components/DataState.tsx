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
  onRetry,
}: {
  state: ResourceState<T>;
  children: (data: T) => ReactNode;
  /** Shown when the request succeeded but there is nothing to display. */
  empty?: ReactNode;
  isEmpty?: (data: T) => boolean;
  /**
   * Reloads the resource (typically `useResource`'s own `reload`). Offered
   * to the reader only when the error is one retrying can plausibly fix —
   * see `ApiError.isRetryable` (REM-7).
   */
  onRetry?: () => void;
}) {
  if (state.status === "loading") {
    return (
      <p className="state state-loading" role="status">
        Завантаження…
      </p>
    );
  }

  if (state.status === "error") {
    return <ErrorState error={state.error} onRetry={onRetry} />;
  }

  if (isEmpty?.(state.data)) {
    return <div className="state state-empty">{empty ?? <p>Немає даних для показу.</p>}</div>;
  }

  return <>{children(state.data)}</>;
}

export function ErrorState({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const canRetry = Boolean(onRetry) && error.isRetryable;
  return (
    <div className="state state-error" role="alert">
      <h2>{title(error)}</h2>
      <p>{explanation(error) ?? error.message}</p>
      {error.source && <p className="muted">Джерельна система: {error.source}</p>}
      {error.requestId && (
        <p className="muted">
          Ідентифікатор запиту: <code>{error.requestId}</code>
        </p>
      )}
      {canRetry && (
        <button type="button" className="secondary" onClick={onRetry}>
          Спробувати ще раз
        </button>
      )}
    </div>
  );
}

function title(error: ApiError): string {
  if (error.isForbidden) return "Немає доступу";
  if (error.isNotFound) return "Не знайдено";
  if (error.isUpstream) return "Джерельна система недоступна";
  if (error.isUnauthenticated) return "Сесія завершилася";
  // A deployment that leaves an integration out is a supported configuration,
  // not a failure, and it is the state a reader meets most often on a stage
  // deployment. Falling through to "Помилка" reports it as a fault and leaves
  // the reader with nothing to do about it.
  if (error.isNotConfigured) return "Інтеграцію не налаштовано";
  if (error.isCapabilityUnsupported) return "Інтеграція не підтримує цю дію";
  if (error.isUnavailable) return "Платформа тимчасово недоступна";
  return "Помилка";
}

/**
 * A Ukrainian explanation for the failures whose cause the platform states
 * unambiguously through a code.
 *
 * Elsewhere the platform's own summary is shown unchanged, because only it
 * knows what went wrong. For these two the code says it exactly, and the
 * reader's next step differs: one is a setting somebody has to supply, the
 * other is a limit of the deployed version that no setting will change.
 */
function explanation(error: ApiError): string | null {
  if (error.isNotConfigured) {
    return "Цю джерельну систему не підключено в цьому середовищі. Дані недоступні, доки її не налаштують — це не збій платформи.";
  }
  if (error.isCapabilityUnsupported) {
    return "Джерельну систему підключено, але її адаптер не вміє виконати цей запит у цій версії платформи.";
  }
  return null;
}
