import { describe, expect, it } from "vitest";
import { buildLaunchUrl, safeModuleLaunchUrl, splitLaunchUrl } from "./moduleLaunchUrl";

const ORIGINS = ["https://redmine.internal", "https://wiki.internal"];

describe("safeModuleLaunchUrl", () => {
  it("accepts a valid https URL", () => {
    expect(safeModuleLaunchUrl("https://redmine.internal/issues/1")).toBe("https://redmine.internal/issues/1");
  });

  it("rejects a javascript: URI", () => {
    expect(safeModuleLaunchUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects a data: URI", () => {
    expect(safeModuleLaunchUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rejects a file: URI", () => {
    expect(safeModuleLaunchUrl("file:///etc/passwd")).toBeNull();
  });

  it("rejects a malformed value", () => {
    expect(safeModuleLaunchUrl("not a url")).toBeNull();
  });

  it("rejects a relative URL rather than assuming same-origin", () => {
    expect(safeModuleLaunchUrl("/projects/42")).toBeNull();
  });

  it("rejects http — ADR-006 assumes HTTPS canonical origins throughout", () => {
    expect(safeModuleLaunchUrl("http://redmine.internal/issues/1")).toBeNull();
  });

  it("rejects an unexpected protocol", () => {
    expect(safeModuleLaunchUrl("ftp://files.internal/x")).toBeNull();
  });

  it("returns null for an absent value", () => {
    expect(safeModuleLaunchUrl(undefined)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(safeModuleLaunchUrl("")).toBeNull();
  });
});

describe("buildLaunchUrl", () => {
  it("builds a URL from a canonical origin and a path", () => {
    expect(buildLaunchUrl("https://redmine.internal", "issues/42", ORIGINS)).toBe(
      "https://redmine.internal/issues/42",
    );
  });

  it("builds a bare origin when no path is given", () => {
    expect(buildLaunchUrl("https://redmine.internal", "", ORIGINS)).toBe("https://redmine.internal/");
  });

  it("normalizes a leading slash on the path", () => {
    expect(buildLaunchUrl("https://redmine.internal", "/issues/42", ORIGINS)).toBe(
      "https://redmine.internal/issues/42",
    );
  });

  it("rejects an origin outside the allowlist, even though it is a well-formed https URL", () => {
    expect(buildLaunchUrl("https://evil.example.com", "phish", ORIGINS)).toBeUndefined();
  });

  it("rejects an empty origin", () => {
    expect(buildLaunchUrl("", "issues/42", ORIGINS)).toBeUndefined();
  });

  it("never hands back a value safeModuleLaunchUrl would reject", () => {
    const built = buildLaunchUrl("https://redmine.internal", "issues/42", ORIGINS);
    expect(safeModuleLaunchUrl(built)).toBe(built);
  });

  // The origin always comes from the allowlist (always https:), so the only
  // way an admin-entered value could smuggle a different protocol is
  // through the free-text path. It cannot: the path is appended after an
  // already-absolute https: origin, so "javascript:..." just becomes a path
  // segment, never a scheme. (A truly malformed *origin* can't reach this
  // function at all — it would already have failed the allowlist check
  // above; `safeModuleLaunchUrl`'s own malformed-URL case is covered by its
  // dedicated test.)
  it("cannot be tricked into an unsafe protocol via the path", () => {
    const built = buildLaunchUrl("https://redmine.internal", "javascript:alert(1)", ORIGINS);
    expect(built).toBe("https://redmine.internal/javascript:alert(1)");
    expect(new URL(built as string).protocol).toBe("https:");
  });
});

describe("splitLaunchUrl", () => {
  it("splits a stored URL back into its origin and path", () => {
    expect(splitLaunchUrl("https://redmine.internal/issues/42", ORIGINS)).toEqual({
      origin: "https://redmine.internal",
      path: "issues/42",
    });
  });

  it("splits a bare origin into an empty path", () => {
    expect(splitLaunchUrl("https://redmine.internal", ORIGINS)).toEqual({
      origin: "https://redmine.internal",
      path: "",
    });
  });

  it("round-trips through buildLaunchUrl for every allowed origin", () => {
    for (const origin of ORIGINS) {
      const built = buildLaunchUrl(origin, "some/path", ORIGINS);
      expect(splitLaunchUrl(built, ORIGINS)).toEqual({ origin, path: "some/path" });
    }
  });

  it("returns empty strings for a URL whose origin is no longer allowed", () => {
    expect(splitLaunchUrl("https://evil.example.com/phish", ORIGINS)).toEqual({ origin: "", path: "" });
  });

  it("returns empty strings for an absent URL", () => {
    expect(splitLaunchUrl(undefined, ORIGINS)).toEqual({ origin: "", path: "" });
  });
});
