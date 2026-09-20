import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError, RequestCancelled } from "./client";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function newClient(fetchImpl: typeof fetch, token: string | null = "test-token", onUnauthenticated?: () => void) {
  return new ApiClient({
    getToken: async () => token,
    fetchImpl,
    onUnauthenticated,
    newRequestId: () => "test-request-id",
  });
}

describe("ApiClient", () => {
  it("sends the bearer token, a request id and an Accept header", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "USR-000001" }));
    await newClient(fetchImpl as unknown as typeof fetch).request("/api/v1/me");

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/me");
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-token");
    expect(headers.get("X-Request-ID")).toBe("test-request-id");
    expect(headers.get("Accept")).toBe("application/json");
  });

  // Without a session there is no token to send. Sending an empty bearer
  // header would be rejected differently from sending none at all.
  it("omits the Authorization header when there is no session", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    await newClient(fetchImpl as unknown as typeof fetch, null).request("/api/v1/me");

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
  });

  it("builds query strings, omitting empty values", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: [], pagination: { total: 0, limit: 0 } }));
    await newClient(fetchImpl as unknown as typeof fetch).collection("/api/v1/clients", {
      query: { limit: 25, cursor: undefined, project: "" },
    });

    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(url).toBe("/api/v1/clients?limit=25");
  });

  it("returns the collection envelope unchanged", async () => {
    const envelope = {
      data: [{ id: "CL-000001", source: "espocrm", source_id: "acc-1", name: "Northwind" }],
      pagination: { total: 3, limit: 1, next_cursor: "bzox" },
    };
    const fetchImpl = vi.fn(async () => jsonResponse(envelope));
    const result = await newClient(fetchImpl as unknown as typeof fetch).collection("/api/v1/clients");
    expect(result).toEqual(envelope);
  });

  describe("failures", () => {
    // The platform answers every failure with one shape, so the client parses
    // it once and no page has to interpret a status code itself.
    it.each([
      { status: 401, code: undefined, flag: "isUnauthenticated" as const },
      { status: 403, code: "permission_required", flag: "isForbidden" as const },
      { status: 404, code: "not_found", flag: "isNotFound" as const },
      { status: 502, code: "upstream_unavailable", flag: "isUpstream" as const },
    ])("parses a $status into a typed ApiError", async ({ status, code, flag }) => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse({ error: "denied", code, source: "espocrm" }, { status }),
      );
      const error = await newClient(fetchImpl as unknown as typeof fetch)
        .request("/api/v1/clients")
        .catch((cause: unknown) => cause);

      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(status);
      expect(apiError.message).toBe("denied");
      expect(apiError.code).toBe(code);
      expect(apiError[flag]).toBe(true);
    });

    // A proxy or gateway can answer with HTML rather than the platform's error
    // shape. The user still needs to be told something better than nothing.
    it("still produces a usable error when the body is not the platform's shape", async () => {
      const fetchImpl = vi.fn(async () => new Response("<html>gateway</html>", { status: 502 }));
      const error = (await newClient(fetchImpl as unknown as typeof fetch)
        .request("/api/v1/clients")
        .catch((cause: unknown) => cause)) as ApiError;

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(502);
      expect(error.message).not.toBe("");
    });

    it("prefers the platform's correlation id over the one it generated", async () => {
      const fetchImpl = vi.fn(async () =>
        jsonResponse({ error: "denied" }, { status: 403, headers: { "X-Request-ID": "core-request-id" } }),
      );
      const error = (await newClient(fetchImpl as unknown as typeof fetch)
        .request("/api/v1/clients")
        .catch((cause: unknown) => cause)) as ApiError;

      expect(error.requestId).toBe("core-request-id");
    });

    // An expired session must end the local session rather than leaving the
    // user on a page that can never load.
    it("notifies the host once when the token is rejected", async () => {
      const onUnauthenticated = vi.fn();
      const fetchImpl = vi.fn(async () => jsonResponse({ error: "expired" }, { status: 401 }));
      await newClient(fetchImpl as unknown as typeof fetch, "stale", onUnauthenticated)
        .request("/api/v1/me")
        .catch(() => undefined);

      expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    });

    it("does not treat a forbidden response as a lost session", async () => {
      const onUnauthenticated = vi.fn();
      const fetchImpl = vi.fn(async () => jsonResponse({ error: "denied" }, { status: 403 }));
      await newClient(fetchImpl as unknown as typeof fetch, "token", onUnauthenticated)
        .request("/api/v1/clients")
        .catch(() => undefined);

      expect(onUnauthenticated).not.toHaveBeenCalled();
    });

    it("reports an unreachable platform rather than throwing a transport error", async () => {
      const fetchImpl = vi.fn(async () => {
        throw new TypeError("network down");
      });
      const error = (await newClient(fetchImpl as unknown as typeof fetch)
        .request("/api/v1/me")
        .catch((cause: unknown) => cause)) as ApiError;

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(0);
    });
  });

  // A user navigating away is not a failure to report. Rendering an error for
  // a page they have already left would be noise at best.
  it("distinguishes cancellation from failure", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });

    const error = await newClient(fetchImpl as unknown as typeof fetch)
      .request("/api/v1/clients", { signal: controller.signal })
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(RequestCancelled);
    expect(error).not.toBeInstanceOf(ApiError);
  });

  // Since REM-5A, fetch receives the client's own internal AbortController
  // signal (so a timeout can abort the same in-flight request) rather than
  // the caller's signal by identity. What matters functionally is that
  // aborting the caller's signal still aborts the in-flight fetch — checked
  // here while the request is genuinely pending, not after the fact.
  it("propagates the caller's abort signal through to an in-flight fetch", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          if (init.signal?.aborted) {
            reject(new DOMException("aborted", "AbortError"));
            return;
          }
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );

    const pending = newClient(fetchImpl as unknown as typeof fetch).request("/api/v1/me", {
      signal: controller.signal,
    });

    // getToken() is awaited before fetch is called, so give that microtask a
    // turn before inspecting the mock.
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect((init.signal as AbortSignal).aborted).toBe(false);

    controller.abort();
    const error = await pending.catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(RequestCancelled);
    expect((init.signal as AbortSignal).aborted).toBe(true);
  });

  describe("client-side request timeout (REM-5A)", () => {
    function newTimeoutClient(fetchImpl: typeof fetch, timeoutMs: number) {
      return new ApiClient({
        getToken: async () => "test-token",
        fetchImpl,
        timeoutMs,
        newRequestId: () => "test-request-id",
      });
    }

    it("A. a normal response completing before the deadline still succeeds", async () => {
      const fetchImpl = vi.fn(async () => jsonResponse({ id: "USR-000001" }));
      const result = await newTimeoutClient(fetchImpl as unknown as typeof fetch, 50).request("/api/v1/me");
      expect(result).toEqual({ id: "USR-000001" });
    });

    it("B. a request exceeding the deadline produces a distinguishable timeout ApiError, not RequestCancelled", async () => {
      const fetchImpl = vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            if (init.signal?.aborted) {
            reject(new DOMException("aborted", "AbortError"));
            return;
          }
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          }),
      );

      const error = await newTimeoutClient(fetchImpl as unknown as typeof fetch, 10)
        .request("/api/v1/me")
        .catch((cause: unknown) => cause);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).not.toBeInstanceOf(RequestCancelled);
      expect((error as ApiError).isTimeout).toBe(true);
    });

    it("C. caller-initiated abort still wins over an eventual timeout and stays RequestCancelled", async () => {
      const controller = new AbortController();
      const fetchImpl = vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            if (init.signal?.aborted) {
            reject(new DOMException("aborted", "AbortError"));
            return;
          }
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          }),
      );

      const pending = newTimeoutClient(fetchImpl as unknown as typeof fetch, 10_000).request("/api/v1/me", {
        signal: controller.signal,
      });
      controller.abort();
      const error = await pending.catch((cause: unknown) => cause);

      expect(error).toBeInstanceOf(RequestCancelled);
    });

    // The bug this test guards against: the timeout callback fires first and
    // aborts the shared internal AbortController; shortly after, the caller
    // *also* aborts its own signal (e.g. an unrelated unmount racing with an
    // already-expired deadline). Before the correction, `callerCancelled`
    // was checked unconditionally in the catch block, so this sequence was
    // misclassified as RequestCancelled even though the timeout genuinely
    // fired first. Fake timers make the firing order explicit and
    // reproducible rather than relying on real-clock timing.
    it("D. a timeout that fires before a later caller abort is classified as a timeout, not a cancellation (first cause wins)", async () => {
      vi.useFakeTimers();
      try {
        const controller = new AbortController();
        const fetchImpl = vi.fn(
          (_url: string, init: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
              if (init.signal?.aborted) {
                reject(new DOMException("aborted", "AbortError"));
                return;
              }
              init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
            }),
        );

        // .catch is chained in the same synchronous tick the promise is
        // created, so the rejection this test deliberately provokes is never
        // briefly unhandled while timers are advanced below.
        const pending = newTimeoutClient(fetchImpl as unknown as typeof fetch, 10)
          .request("/api/v1/me", { signal: controller.signal })
          .catch((cause: unknown) => cause);

        // The deadline fires first...
        await vi.advanceTimersByTimeAsync(10);
        // ...and only afterward does the caller also abort.
        controller.abort();

        const error = await pending;

        expect(error).toBeInstanceOf(ApiError);
        expect(error).not.toBeInstanceOf(RequestCancelled);
        expect((error as ApiError).isTimeout).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("sends a JSON body with the right content type", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }));
    await newClient(fetchImpl as unknown as typeof fetch).request("/api/v1/global-ids", {
      method: "POST",
      body: { entity_type: "client" },
    });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ entity_type: "client" }));
  });
});
