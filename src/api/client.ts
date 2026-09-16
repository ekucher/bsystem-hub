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
   */
  onUnauthenticated?: () => void;
  /** Overridable for tests. */
  fetchImpl?: typeof fetch;
  /** Overridable for tests; production uses a random UUID per request. */
  newRequestId?: () => string;
  /** Base URL, for a HUB served from a different origin than the API. */
  baseUrl?: string;
};

export type RequestOptions = {
  signal?: AbortSignal;
  query?: Record<string, string | number | undefined>;
  method?: string;
  body?: unknown;
};

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

    let response: Response;
    try {
      response = await doFetch(this.url(path, options.query), {
        method: options.method ?? "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      });
    } catch (cause) {
      // An aborted request is not a failure to report: the user moved on.
      if (options.signal?.aborted || (cause instanceof DOMException && cause.name === "AbortError")) {
        throw new RequestCancelled();
      }
      throw new ApiError({ status: 0, message: "Не вдалося зв'язатися з Integration Core", requestId });
    }

    if (response.ok) {
      if (response.status === 204) return undefined as T;
      return (await this.parseBody(response, requestId)) as T;
    }

    const error = await this.parseError(response, requestId);
    if (error.isUnauthenticated) this.options.onUnauthenticated?.();
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
