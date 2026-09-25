import type { LaunchOrigin } from "../api/types";

/**
 * Validates a module registry's launch_url before it is ever used as an
 * anchor href. This is a protocol/scheme safety check only (REM-3).
 *
 * Only `https:` is allowed — ADR-006 assumes HTTPS canonical origins
 * throughout, so `http:` is rejected rather than assumed supported.
 *
 * This is the ONE safety boundary a module launch URL passes through,
 * whether it is about to be rendered as an anchor href (Dashboard.tsx) or
 * just built from an admin-picked origin (`buildLaunchUrl` below, which
 * calls back into this function rather than maintaining its own notion of
 * "safe"). Origin *trust* (which origins are allowed at all) is a separate,
 * resolved concern — see ADR-006 — enforced by `buildLaunchUrl`'s allowlist
 * check and, authoritatively, by Integration Core; this function only ever
 * answers "is this a well-formed https: URL."
 */
const ALLOWED_PROTOCOLS = new Set(["https:"]);

export function safeModuleLaunchUrl(raw: string | undefined): string | null {
  if (!raw) return null;

  let parsed: URL;
  try {
    // No base is supplied on purpose: a relative URL ("/projects/42") throws
    // here and is rejected, rather than being silently treated as
    // same-origin — that would itself be an origin-policy decision.
    parsed = new URL(raw);
  } catch {
    return null;
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null;

  return parsed.toString();
}

/**
 * Builds an admin-entered launch URL from a canonical origin (chosen from
 * the platform-provided allowlist, never typed freely) plus an optional
 * path — the single place `/admin/modules` (Modules.tsx) constructs one, for
 * both creating and editing a module.
 *
 * `allowedOrigins` is checked defensively: the admin form only ever offers
 * an allowlisted origin as a `<select>` option, but a tampered request
 * (e.g. a hand-edited DOM value) must not produce a launch_url this
 * function will still hand back — Integration Core re-validates the
 * allowlist regardless, but there is no reason for the client to be looser
 * than its own UI already promises.
 *
 * The candidate is run back through `safeModuleLaunchUrl` before being
 * returned, so a value this function returns is, by construction, exactly
 * the kind of value the launcher's own render-time check would also accept
 * — one safety boundary, not two uncoordinated ones.
 */
export function buildLaunchUrl(
  origin: LaunchOrigin,
  path: string,
  allowedOrigins: readonly LaunchOrigin[],
): string | undefined {
  if (!origin || !allowedOrigins.includes(origin)) return undefined;
  const trimmedOrigin = origin.replace(/\/+$/, "");
  const trimmedPath = path.trim().replace(/^\/+/, "");
  const candidate = trimmedPath ? `${trimmedOrigin}/${trimmedPath}` : trimmedOrigin;
  return safeModuleLaunchUrl(candidate) ?? undefined;
}

/**
 * The inverse of `buildLaunchUrl`: splits a stored launch_url back into the
 * origin + path the edit form needs to pre-fill its controls with. Returns
 * empty strings when the url is absent or its origin isn't (or is no longer)
 * in `allowedOrigins` — the edit form then shows "no launch URL selected"
 * rather than silently keeping an origin the platform no longer trusts.
 */
export function splitLaunchUrl(
  url: string | undefined,
  allowedOrigins: readonly LaunchOrigin[],
): { origin: LaunchOrigin; path: string } {
  if (!url) return { origin: "", path: "" };
  const origin = allowedOrigins.find((candidate) => url === candidate || url.startsWith(`${candidate}/`));
  if (!origin) return { origin: "", path: "" };
  return { origin, path: url.slice(origin.length).replace(/^\/+/, "") };
}
