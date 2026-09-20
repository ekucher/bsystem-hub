/**
 * Validates a module registry's launch_url before it is ever used as an
 * anchor href. This is a protocol/scheme safety check only (REM-3) — it does
 * NOT decide an origin trust policy (same-origin only vs. an explicit
 * trusted-module allowlist vs. arbitrary HTTPS origins). That decision is
 * unresolved (see .unlazy/audit/REMEDIATION.md, REM-3-ARCH, disposition
 * HOLD) and is deliberately not made here.
 *
 * Only `https:` is currently allowed. No fixture, test, or documentation in
 * this repository establishes a concrete launch_url value or scheme, so
 * `http:` support is not assumed — expanding the allowed scheme set is a
 * product decision, not a safety fix, and belongs with REM-3-ARCH.
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
