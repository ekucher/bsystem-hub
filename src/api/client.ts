import type { Collection } from "./types";

/**
 * A failure returned by the Integration Core, or by the attempt to reach it.
 *
 * The platform answers every failure with the same shape, so the HUB parses it
 * once here rather than at each call site. `code` is the stable
 * machine-readable form where the platform defines one; `message` is safe to
 * show because the platform guarantees it carries no credential, internal
 * hostname or upstream payload.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly source?: string;
  readonly requestId?: string;

  constructor(init: { status: number; message: string; code?: string; source?: string; requestId?: string }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.source = init.source;
    this.requestId = init.requestId;
  }

  /** The caller is not authenticated, or their session has expired. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  /** The caller is authenticated but not authorized. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  /** No such resource, or the caller may not learn that there is one. */
  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** A source system failed. The platform, not the data, is at fault. */
  get isUpstream(): boolean {
    return this.status === 502;
  }

  /**
   * The platform could not serve the request because something it depends on
   * is unavailable. Distinct from `isUpstream`: there the source system was
   * reached and failed; here it was never reached at all.
   */
  get isUnavailable(): boolean {
    return this.status === 503;
  }

  /**
   * The integration this endpoint reads from is not configured in this
   * deployment.
   *
   * This is a supported configuration, not a fault — a stage deployment may
   * deliberately leave a source system out — so it must not be presented as a
   * failure. It is also the one error state the reader can act on themselves,
   * which is why it is worth telling apart from the rest.
   */
  get isNotConfigured(): boolean {
    return this.code === "adapter_not_configured";
  }

  /**
   * The integration is configured but cannot do what this endpoint needs.
   * Unlike `isNotConfigured`, configuring it differently will not help.
   */
  get isCapabilityUnsupported(): boolean {
    return this.code === "capability_unsupported";
  }

  /**
   * The client gave up waiting for a response (REM-5A) — distinct from a
   * general connection failure (`status === 0` with no code): here the
   * request was sent and simply took too long, not refused or unreachable.
   */
  get isTimeout(): boolean {
    return this.code === "client_timeout";
  }

  /**
   * Whether retrying the same request has a real chance of succeeding
   * (REM-7). `isForbidden`/`isNotFound`/`isUnauthenticated` describe the
   * caller or the resource, not a transient condition — retrying changes
   * nothing. `isNotConfigured`/`isCapabilityUnsupported` are a deployment's
   * supported shape, not a fault (see DataState's own docs) — also not
   * something a retry fixes. A connection failure or timeout (`status ===
   * 0`), `isUpstream` (502), and an otherwise-unexplained `isUnavailable`
   * (503) are the failure modes retrying can plausibly resolve.
   */
  get isRetryable(): boolean {
    if (this.isForbidden || this.isNotFound || this.isUnauthenticated) return false;
    if (this.isNotConfigured || this.isCapabilityUnsupported) return false;
    return this.status === 0 || this.isUpstream || this.isUnavailable;
  }
}

/** Raised when a request is abandoned because the caller navigated away. */
export class RequestCancelled extends Error {
  constructor() {
    super("request cancelled");
    this.name = "RequestCancelled";
  }
}

export type TokenProvider = () => Promise<string | null>;

export type ApiClientOptions = {
  /** Supplies the current access token, or null when there is no session. */
  getToken: TokenProvider;
  /**
   * Called when the platform rejects the token. The HUB uses it to end the
   * local session rather than leaving the user on a page that cannot load.
   *
   * May return a Promise (REM-17 correction): `request()` awaits it before
   * settling, so a caller that awaits the request is guaranteed the session
   * has actually finished ending — including removing the rejected OIDC
   * user from storage — not merely that ending was scheduled.
   */
  onUnauthenticated?: () => void | Promise<void>;
  /** Overridable for tests. */
  fetchImpl?: typeof fetch;
  /** Overridable for tests; production uses a random UUID per request. */
  newRequestId?: () => string;
  /** Base URL, for a HUB served from a different origin than the API. */
  baseUrl?: string;
  /** Overridable for tests; production uses DEFAULT_REQUEST_TIMEOUT_MS. */
  timeoutMs?: number;
};

export type RequestOptions = {
  signal?: AbortSignal;
  query?: Record<string, string | number | undefined>;
  method?: string;
  body?: unknown;
};

/**
 * How long a request may run before the client gives up (REM-5A).
 *
 * Chosen relative to nginx's explicit upstream timeout policy (REM-5B,
 * nginx.conf's `/api/` location: `proxy_connect_timeout 5s;
 * proxy_read_timeout 25s;`): the client times out at 20s, five seconds
 * before nginx's own 25s read timeout would fire. That ordering is
 * deliberate — the user sees the HUB's own "timed out" message
 * (distinguishable via `ApiError.isTimeout`) instead of a generic upstream
 * gateway error reaching the browser first.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;

function defaultRequestId(): string {
  // crypto.randomUUID is unavailable over plain HTTP in some browsers, so a
  // weaker fallback keeps correlation working rather than dropping it.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `hub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * The single way the HUB talks to the Integration Core.
 *
 * Every request carries the bearer token and an `X-Request-ID`, so one
 * identifier traces a user action through the platform, its adapters and the
 * audit trail. Every failure arrives as an ApiError, so no page has to
 * interpret a status code itself.
 */
export class ApiClient {
  private readonly options: ApiClientOptions;

  constructor(options: ApiClientOptions) {
    this.options = options;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const doFetch = this.options.fetchImpl ?? fetch;
    const newRequestId = this.options.newRequestId ?? defaultRequestId;
    const requestId = newRequestId();

    const headers = new Headers({ Accept: "application/json", "X-Request-ID": requestId });
    const token = await this.options.getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (options.body !== undefined) headers.set("Content-Type", "application/json");

    // A caller-supplied AbortSignal (user navigation, unmount) must keep
    // producing RequestCancelled. A client-side deadline (REM-5A) must
    // produce a distinguishable timeout ApiError instead — the two share one
    // underlying AbortController (fetch only accepts one signal), so which
    // one actually fired must be tracked explicitly rather than inferred
    // from the signal or the thrown error's type alone.
    //
    // Correction: this used to be two independent booleans (`timedOut`,
    // `callerCancelled`) that could both end up `true` if the caller aborted
    // shortly after the timeout already fired — the catch block then always
    // treated a caller abort as taking priority, regardless of which cause
    // actually fired first. `abortCause` is written at most once (the
    // callback that runs first "wins," and JS's single-threaded event loop
    // makes that first write unambiguous — there is no true data race, only
    // an event-ordering one), so classification below reflects whichever
    // cause actually occurred first, not the order the checks happen to run in.
    const controller = new AbortController();
    let abortCause: "caller" | "timeout" | null = null;

    const onCallerAbort = () => {
      if (abortCause === null) abortCause = "caller";
      controller.abort();
    };
    if (options.signal) {
      if (options.signal.aborted) onCallerAbort();
      else options.signal.addEventListener("abort", onCallerAbort);
    }

    const timeoutMs = this.options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    const timeoutId = setTimeout(() => {
      if (abortCause === null) abortCause = "timeout";
      controller.abort();
    }, timeoutMs);

    let response: Response;
    try {
      response = await doFetch(this.url(path, options.query), {
        method: options.method ?? "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch {
      // Classification is driven entirely by which cause won `abortCause`
      // above, never by inspecting the thrown error's type — that value can
      // be an AbortError for either cause (or something else entirely for a
      // genuine network failure), and re-deriving the cause from it is
      // exactly the ambiguity this correction removes.
      if (abortCause === "caller") {
        throw new RequestCancelled();
      }
      if (abortCause === "timeout") {
        throw new ApiError({
          status: 0,
          message: "Час очікування відповіді Integration Core вичерпано",
          code: "client_timeout",
          requestId,
        });
      }
      throw new ApiError({ status: 0, message: "Не вдалося зв'язатися з Integration Core", requestId });
    } finally {
      clearTimeout(timeoutId);
      options.signal?.removeEventListener("abort", onCallerAbort);
    }

    if (response.ok) {
      if (response.status === 204) return undefined as T;
      return (await this.parseBody(response, requestId)) as T;
    }

    const error = await this.parseError(response, requestId);
    if (error.isUnauthenticated) await this.options.onUnauthenticated?.();
    throw error;
  }

  /** Reads a collection endpoint, returning the envelope unchanged. */
  collection<T>(path: string, options: RequestOptions = {}): Promise<Collection<T>> {
    return this.request<Collection<T>>(path, options);
  }

  private url(path: string, query?: RequestOptions["query"]): string {
    const base = this.options.baseUrl ?? "";
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== "") search.set(key, String(value));
    }
    const suffix = search.toString();
    return `${base}${path}${suffix ? `?${suffix}` : ""}`;
  }

  private async parseBody(response: Response, requestId: string): Promise<unknown> {
    const text = await response.text();
    if (!text) return undefined;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new ApiError({ status: response.status, message: "Некоректна відповідь Integration Core", requestId });
    }
  }

  /**
   * Turns a failure response into an ApiError.
   *
   * A body that is missing or unparseable still produces a usable error: a
   * proxy or gateway can answer with HTML, and the user needs to be told
   * something better than nothing.
   */
  private async parseError(response: Response, requestId: string): Promise<ApiError> {
    const correlationId = response.headers.get("X-Request-ID") ?? requestId;
    let payload: { error?: string; code?: string; source?: string } = {};
    try {
      const text = await response.text();
      if (text) payload = JSON.parse(text) as typeof payload;
    } catch {
      // Left empty on purpose; the status alone still describes the failure.
    }
    return new ApiError({
      status: response.status,
      message: payload.error ?? describeStatus(response.status),
      code: payload.code,
      source: payload.source,
      requestId: correlationId,
    });
  }
}

/** A readable fallback for a failure the platform did not describe. */
function describeStatus(status: number): string {
  switch (status) {
    case 401:
      return "Сесія недійсна або завершилася";
    case 403:
      return "Недостатньо прав для цієї дії";
    case 404:
      return "Ресурс не знайдено";
    case 502:
      return "Джерельна система тимчасово недоступна";
    case 503:
      return "Платформа тимчасово недоступна";
    default:
      return `Помилка Integration Core (HTTP ${status})`;
  }
}
