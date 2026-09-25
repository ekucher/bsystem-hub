import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { Profile } from "./Profile";
import { renderWithSession, ADMIN } from "../test/render";
import type { Me } from "../api/types";

describe("Profile", () => {
  it("renders valid groups, roles and permissions normally", async () => {
    renderWithSession(<Profile />, { me: ADMIN });
    expect(await screen.findByText("BSYSTEM-Admins")).toBeInTheDocument();
    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  // F-01 (Phase 3.0): malformed/null `groups`/`roles`/`permissions` fields on
  // the current user must not crash the profile page — the API contract
  // promises Me.{groups,roles,permissions}: string[], but a runtime response
  // is not guaranteed to keep that promise.
  it("does not crash when groups is null and shows the empty state", async () => {
    const malformedMe: Me = { ...ADMIN, groups: null as unknown as string[] };
    renderWithSession(<Profile />, { me: malformedMe });
    expect(await screen.findByRole("heading", { level: 1, name: "Профіль" })).toBeInTheDocument();
    expect(screen.getByText("Користувач не входить до жодної групи.")).toBeInTheDocument();
  });

  it("does not crash when roles is null and shows the empty state", async () => {
    const malformedMe: Me = { ...ADMIN, roles: null as unknown as string[] };
    renderWithSession(<Profile />, { me: malformedMe });
    expect(await screen.findByRole("heading", { level: 1, name: "Профіль" })).toBeInTheDocument();
    expect(screen.getByText("Групи користувача не зіставлені з жодною роллю BSYSTEM.")).toBeInTheDocument();
  });

  it("does not crash when permissions is null and shows the empty state", async () => {
    const malformedMe: Me = { ...ADMIN, permissions: null as unknown as string[] };
    renderWithSession(<Profile />, { me: malformedMe });
    expect(await screen.findByRole("heading", { level: 1, name: "Профіль" })).toBeInTheDocument();
    expect(screen.getByText("Ролі користувача не надають жодного дозволу.")).toBeInTheDocument();
  });

  it("does not crash when groups, roles and permissions are all non-array values", async () => {
    const malformedMe: Me = {
      ...ADMIN,
      groups: "BSYSTEM-Admins" as unknown as string[],
      roles: 42 as unknown as string[],
      permissions: undefined as unknown as string[],
    };
    renderWithSession(<Profile />, { me: malformedMe });
    expect(await screen.findByRole("heading", { level: 1, name: "Профіль" })).toBeInTheDocument();
  });
});
