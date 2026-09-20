import { describe, expect, it } from "vitest";
import { safeModuleLaunchUrl } from "./moduleLaunchUrl";

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

  it("rejects an unsupported protocol (http, pending an explicit origin/scheme policy decision)", () => {
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
