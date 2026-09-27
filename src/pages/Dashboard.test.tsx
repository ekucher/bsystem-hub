import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { Dashboard } from "./Dashboard";
import { renderWithSession, ADMIN, stubFetch } from "../test/render";
import type { Me } from "../api/types";

const MODULES = [{ id: "crm", name: "CRM", description: "Клієнти", status: "available" }];

function platform() {
  return stubFetch({ "/api/v1/modules": { body: MODULES } });
}

describe("Dashboard", () => {
  it("renders valid roles normally", async () => {
    renderWithSession(<Dashboard />, { fetchImpl: platform(), me: ADMIN });
    expect(await screen.findByText("Administrator")).toBeInTheDocument();
  });

  // F-01 (Phase 3.0): a malformed/null `roles` field on the current user must
  // not crash the dashboard — the API contract promises Me.roles: string[],
  // but a runtime response is not guaranteed to keep that promise. Mirrors
  // the REM-8 regression test already covering this class of defect for
  // Users.tsx (src/App.test.tsx: "does not crash the user directory when an
  // account's roles field is null").
  it("does not crash when the current user's roles field is null", async () => {
    const malformedMe: Me = { ...ADMIN, roles: null as unknown as string[] };
    renderWithSession(<Dashboard />, { fetchImpl: platform(), me: malformedMe });
    expect(await screen.findByRole("heading", { level: 1, name: /Вітаємо/ })).toBeInTheDocument();
    expect(screen.queryByText("Administrator")).not.toBeInTheDocument();
  });

  it("does not crash when the current user's roles field is a non-array value", async () => {
    const malformedMe: Me = { ...ADMIN, roles: "Administrator" as unknown as string[] };
    renderWithSession(<Dashboard />, { fetchImpl: platform(), me: malformedMe });
    expect(await screen.findByRole("heading", { level: 1, name: /Вітаємо/ })).toBeInTheDocument();
  });

  it("does not crash when the current user's roles field is undefined", async () => {
    const malformedMe: Me = { ...ADMIN, roles: undefined as unknown as string[] };
    renderWithSession(<Dashboard />, { fetchImpl: platform(), me: malformedMe });
    expect(await screen.findByRole("heading", { level: 1, name: /Вітаємо/ })).toBeInTheDocument();
  });
});
