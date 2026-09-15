import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRoutes } from "./App";
import { renderWithSession, stubFetch, UNMAPPED } from "./test/render";
import { expectNoAccessibilityViolations } from "./test/axe";

const MODULES = [{ id: "crm", name: "CRM", description: "Клієнти", status: "available" }];

const CLIENTS = {
  data: [
    { id: "CL-000001", source: "espocrm", source_id: "acc-northwind", name: "Northwind Trading", email: "info@northwind.example.invalid" },
    { id: "CL-000002", source: "espocrm", source_id: "acc-globex", name: "Globex Industrial" },
  ],
  pagination: { total: 2, limit: 2 },
};

function platform(overrides: Record<string, { status?: number; body: unknown }> = {}) {
  return stubFetch({
    "/api/v1/modules": { body: MODULES },
    "/api/v1/clients": { body: CLIENTS },
    "/api/v1/projects": { body: { data: [], pagination: { total: 0, limit: 0 } } },
    "/api/v1/issues": { body: { data: [], pagination: { total: 0, limit: 0 } } },
    "/api/v1/documents": { body: { data: [], pagination: { total: 0, limit: 0 } } },
    "/api/v1/clients/CL-000001": {
      body: { id: "CL-000001", source: "espocrm", source_id: "acc-northwind", name: "Northwind Trading", email: "info@northwind.example.invalid" },
    },
    ...overrides,
  });
}

describe("routing", () => {
  it("renders the dashboard at the root", async () => {
    renderWithSession(<AppRoutes />, { fetchImpl: platform() });
    expect(await screen.findByRole("heading", { level: 1, name: /Вітаємо/ })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 3, name: "CRM" })).toBeInTheDocument();
  });

  it.each([
    { route: "/profile", heading: "Профіль" },
    { route: "/clients", heading: "Клієнти" },
    { route: "/projects", heading: "Проєкти" },
    { route: "/issues", heading: "Задачі" },
    { route: "/documents", heading: "Документи" },
    { route: "/403", heading: "Немає доступу" },
    { route: "/404", heading: "Сторінку не знайдено" },
  ])("serves $route", async ({ route, heading }) => {
    renderWithSession(<AppRoutes />, { fetchImpl: platform(), route });
    expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
  });

  // An unknown address must land somewhere explanatory rather than on a blank
  // page that looks like a failure.
  it("shows not-found for an unknown route", async () => {
    renderWithSession(<AppRoutes />, { fetchImpl: platform(), route: "/nowhere" });
    expect(await screen.findByRole("heading", { level: 1, name: "Сторінку не знайдено" })).toBeInTheDocument();
  });

  it("navigates from the client list to a client", async () => {
    renderWithSession(<AppRoutes />, { fetchImpl: platform(), route: "/clients" });
    await userEvent.click(await screen.findByRole("link", { name: "Northwind Trading" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Northwind Trading" })).toBeInTheDocument();
    expect(screen.getByText("acc-northwind")).toBeInTheDocument();
  });
});

describe("authorization in the interface", () => {
  // The interface must not offer a destination the platform would refuse.
  // This is presentation only — the platform enforces access regardless.
  it("hides navigation a user has no permission for", async () => {
    renderWithSession(<AppRoutes />, { fetchImpl: platform(), me: UNMAPPED });
    const nav = await screen.findByRole("navigation", { name: "Основна навігація" });
    expect(within(nav).getByRole("link", { name: "Огляд" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Профіль" })).toBeInTheDocument();
    for (const hidden of ["Клієнти", "Проєкти", "Задачі", "Документи"]) {
      expect(within(nav).queryByRole("link", { name: hidden })).not.toBeInTheDocument();
    }
  });

  it("redirects a guarded route to the forbidden page", async () => {
    renderWithSession(<AppRoutes />, { fetchImpl: platform(), me: UNMAPPED, route: "/clients" });
    expect(await screen.findByRole("heading", { level: 1, name: "Немає доступу" })).toBeInTheDocument();
  });

  it("tells an unmapped user why they see no modules", async () => {
    renderWithSession(<AppRoutes />, { fetchImpl: platform({ "/api/v1/modules": { body: [] } }), me: UNMAPPED });
    expect(await screen.findByRole("heading", { level: 3, name: "Немає доступних модулів" })).toBeInTheDocument();
  });
});

describe("failure states", () => {
  // Each failure means something different to the reader, so each is
  // presented differently rather than collapsed into "something went wrong".
  it.each([
    { status: 403, code: "permission_required", error: "crm.client.read permission required", heading: "Немає доступу" },
    { status: 404, code: "not_found", error: "resource not found", heading: "Не знайдено" },
    { status: 502, code: "upstream_unavailable", error: "upstream service unavailable", heading: "Джерельна система недоступна" },
  ])("presents a $status distinctly", async ({ status, code, error, heading }) => {
    renderWithSession(<AppRoutes />, {
      fetchImpl: platform({ "/api/v1/clients": { status, body: { error, code, source: "espocrm" } } }),
      route: "/clients",
    });
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(within(alert).getByText(error)).toBeInTheDocument();
  });

  // A user reporting a problem needs the identifier that ties their request to
  // the platform's audit trail.
  it("shows the correlation id on a failure", async () => {
    renderWithSession(<AppRoutes />, {
      fetchImpl: platform({ "/api/v1/clients": { status: 502, body: { error: "upstream service unavailable", code: "upstream_unavailable" } } }),
      route: "/clients",
    });
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("test-request-id")).toBeInTheDocument();
  });

  it("shows an empty state rather than an empty table", async () => {
    renderWithSession(<AppRoutes />, { fetchImpl: platform(), route: "/projects" });
    expect(await screen.findByText("Немає проєктів.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("announces loading to assistive technology", () => {
    renderWithSession(<AppRoutes />, { fetchImpl: platform(), route: "/clients" });
    expect(screen.getByRole("status")).toHaveTextContent("Завантаження…");
  });
});

describe("pagination", () => {
  it("follows the platform's cursor and does not construct one", async () => {
    const requested: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      requested.push(url);
      const cursor = new URL(url, "http://localhost").searchParams.get("cursor");
      const body = cursor
        ? { data: [{ id: "CL-000003", source: "espocrm", source_id: "acc-initech", name: "Initech" }], pagination: { total: 3, limit: 1 } }
        : { data: [CLIENTS.data[0]], pagination: { total: 3, limit: 1, next_cursor: "bzox" } };
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    renderWithSession(<AppRoutes />, { fetchImpl, route: "/clients" });
    await screen.findByRole("link", { name: "Northwind Trading" });

    const next = screen.getByRole("button", { name: "Далі" });
    expect(screen.getByRole("button", { name: "Назад" })).toBeDisabled();
    await userEvent.click(next);

    expect(await screen.findByRole("link", { name: "Initech" })).toBeInTheDocument();
    expect(requested.some((url) => url.includes("cursor=bzox"))).toBe(true);
    expect(screen.getByRole("button", { name: "Далі" })).toBeDisabled();
  });
});

describe("accessibility", () => {
  it.each([
    { route: "/", name: "dashboard" },
    { route: "/profile", name: "profile" },
    { route: "/clients", name: "clients" },
    { route: "/clients/CL-000001", name: "client detail" },
    { route: "/projects", name: "empty projects" },
    { route: "/403", name: "forbidden" },
    { route: "/404", name: "not found" },
  ])("has no automated violations on the $name page", async ({ route }) => {
    const { container } = renderWithSession(<AppRoutes />, { fetchImpl: platform(), route });
    // Wait for the page to settle, or axe inspects a loading placeholder.
    await waitFor(() => expect(screen.queryByText("Завантаження…")).not.toBeInTheDocument());
    await expectNoAccessibilityViolations(container);
  });

  // A keyboard user must reach the content without tabbing through the whole
  // navigation on every route.
  it("offers a skip link as the first focusable element", async () => {
    renderWithSession(<AppRoutes />, { fetchImpl: platform() });
    await userEvent.tab();
    expect(screen.getByRole("link", { name: /Перейти до основного вмісту/ })).toHaveFocus();
  });

  it("marks the current page in the navigation", async () => {
    renderWithSession(<AppRoutes />, { fetchImpl: platform(), route: "/clients" });
    const nav = await screen.findByRole("navigation", { name: "Основна навігація" });
    expect(within(nav).getByRole("link", { name: "Клієнти" })).toHaveAttribute("aria-current", "page");
  });

  it("lets the user sign out from anywhere", async () => {
    const signOut = vi.fn();
    renderWithSession(<AppRoutes />, { fetchImpl: platform(), signOut, route: "/documents" });
    await userEvent.click(screen.getByRole("button", { name: "Вийти" }));
    expect(signOut).toHaveBeenCalledOnce();
  });
});
