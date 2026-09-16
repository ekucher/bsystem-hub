import { render, type RenderResult } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { ApiClient } from "../api/client";
import type { Me } from "../api/types";
import { SessionProviderContext, hasPermission, type Session } from "../session";

/** A user with every permission, which most page tests want. */
export const ADMIN: Me = {
  id: "USR-000001",
  subject: "mock-admin",
  email: "admin@bsystem.example.invalid",
  name: "Mock Administrator",
  username: "mock-admin",
  groups: ["BSYSTEM-Admins"],
  roles: ["Administrator"],
  permissions: ["*"],
  modules: ["crm", "projects", "wiki"],
};

/** A user whose groups map to no role, which is what deny-by-default looks
 * like from the HUB's side. */
export const UNMAPPED: Me = {
  ...ADMIN,
  id: "USR-000008",
  subject: "mock-no-groups",
  name: "Mock Without Groups",
  username: "mock-no-groups",
  groups: [],
  roles: [],
  permissions: [],
  modules: [],
};

export type RenderOptions = {
  me?: Me | null;
  status?: Session["status"];
  /** Responds to every request the render makes. */
  fetchImpl?: typeof fetch;
  route?: string;
  signOut?: () => void;
};

/** Renders a tree with a session supplied directly, so tests never touch the
 * real OIDC flow. */
export function renderWithSession(ui: ReactNode, options: RenderOptions = {}): RenderResult {
  const me = options.me === undefined ? ADMIN : options.me;
  const api = new ApiClient({
    getToken: async () => "test-token",
    fetchImpl: options.fetchImpl ?? (async () => new Response("{}", { status: 200 })),
    newRequestId: () => "test-request-id",
  });

  const session: Session = {
    status: options.status ?? (me ? "authenticated" : "anonymous"),
    me,
    error: null,
    configured: true,
    api,
    signIn: () => undefined,
    signOut: options.signOut ?? (() => undefined),
    can: (permission) => hasPermission(me, permission),
  };

  return render(
    <SessionProviderContext.Provider value={session}>
      <MemoryRouter initialEntries={[options.route ?? "/"]}>{ui}</MemoryRouter>
    </SessionProviderContext.Provider>,
  );
}

/** Builds a fetch stub that answers by path, so a test states exactly what the
 * platform returns for each endpoint it exercises. */
export function stubFetch(routes: Record<string, { status?: number; body: unknown }>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const path = url.split("?")[0];
    const match = routes[path];
    if (!match) {
      return new Response(JSON.stringify({ error: "not stubbed", code: "not_found" }), { status: 404 });
    }
    return new Response(JSON.stringify(match.body), {
      status: match.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}
