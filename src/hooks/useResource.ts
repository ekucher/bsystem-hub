import { useCallback, useEffect, useState } from "react";
import { ApiError, RequestCancelled } from "../api/client";

export type ResourceState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: T; error: null }
  | { status: "error"; data: null; error: ApiError };

/**
 * Loads one resource, cancelling the request when the component unmounts or
 * its inputs change.
 *
 * Cancellation matters for more than tidiness: without it, a user clicking
 * through a list quickly can have an earlier, slower response overwrite a
 * later one, and the page ends up showing the wrong record.
 */
export function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): ResourceState<T> & { reload: () => void } {
  const [state, setState] = useState<ResourceState<T>>({ status: "loading", data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  // The loader is rebuilt from the caller's dependencies rather than captured
  // once, so a page that navigates between records reloads.
  const run = useCallback(load, deps);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setState({ status: "loading", data: null, error: null });

    run(controller.signal)
      .then((data) => {
        if (active) setState({ status: "ready", data, error: null });
      })
      .catch((cause: unknown) => {
        // A cancelled request belongs to a view the user has already left.
        if (!active || cause instanceof RequestCancelled) return;
        const error =
          cause instanceof ApiError
            ? cause
            : new ApiError({ status: 0, message: cause instanceof Error ? cause.message : "Невідома помилка" });
        setState({ status: "error", data: null, error });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [run, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, reload };
}
