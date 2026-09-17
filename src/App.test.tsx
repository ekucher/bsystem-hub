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

const USERS = [
  {
    id: "USR-000005",
    subject: "authentik-admin-subject",
    email: "admin@bsystem.example.invalid",
    display_name: "Platform Administrator",
    username: "admin",
    groups: ["BSYSTEM-Admins"],
    first_seen_at: "2026-09-17T10:00:00Z",
    last_seen_at: "2026-09-18T01:00:00Z",
  },
];

const NOTIFICATIONS = {
  data: [
    {
      id: 91,
      event: "backup.failed",
      source: "operations",
      severity: "critical" as const,
      title: "Резервне копіювання не вдалося",
      body: "nightly backup exited 1",
      entity_id: "SRV-000004",
      audience_permission: "operations.server.read",
      occurred_at: "2026-01-06T02:14:00Z",
      read: false,
    },
    {
      id: 90,
      event: "release.created",
      source: "ci",
      severity: "info" as const,
      title: "Випуск створено",
      deep_link: "/clients/CL-000001",
      entity_id: "CL-000001",
      audience_permission: "development.repo.read",
      occurred_at: "2026-01-05T09:00:00Z",
      read: true,
    },
  ],
  pagination: { total: 2, limit: 2 },
  unread_count: 1,
};

function platform(overrides: Record<string, { status?: number; body: unknown }> = {}) {
  return stubFetch({
    "/api/v1/notifications": { body: NOTIFICATIONS },
    "/api/v1/modules": { body: MODULES },
    "/api/v1/admin/users": { body: USERS },
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
    { route: "/notifications", heading: "Сповіщення" },
    { route: "/admin/users", heading: "Користувачі" },
    { route: "/403", heading: "Немає доступу" },
    { route: "/404", heading: "Сторінку не знайдено" },
  ])("serves $route", async ({ route, heading }) => {
    renderWithSession(<AppRoutes />, { fetchImpl: platform(), route });
    expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
  });

  it("redirects the OIDC callback route to the dashboard after authentication", async () => {
    renderWithSession(<AppRoutes />, {
      fetchImpl: platform(),
      route: "/auth/callback",
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /Вітаємо/,
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("heading", {
        level: 1,
        name: "Сторінку не знайдено",
      }),
    ).not.toBeInTheDocument();
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
    for (const hidden of ["Клієнти", "Проєкти", "Задачі", "Документи", "Користувачі"]) {
      expect(within(nav).queryByRole("link", { name: hidden })).not.toBeInTheDocument();
    }
  });

  it("redirects a guarded route to the forbidden page", async () => {
    renderWithSession(<AppRoutes />, { fetchImpl: platform(), me: UNMAPPED, route: "/clients" });
    expect(await screen.findByRole("heading", { level: 1, name: "Немає доступу" })).toBeInTheDocument();
  });

  it("guards the user directory with the platform permission", async () => {
    renderWithSession(<AppRoutes />, { fetchImpl: platform(), me: UNMAPPED, route: "/admin/users" });
    expect(await screen.findByRole("heading", { level: 1, name: "Немає доступу" })).toBeInTheDocument();
  });

  it("renders persistent identities with their immutable Global IDs", async () => {
    renderWithSession(<AppRoutes />, { fetchImpl: platform(), route: "/admin/users" });
    const table = await screen.findByRole("table", { name: "Користувачі BSYSTEM та їхні Global ID" });
    expect(within(table).getByText("Platform Administrator")).toBeInTheDocument();
    expect(within(table).getByText("USR-000005")).toBeInTheDocument();
    expect(within(table).getByText("BSYSTEM-Admins")).toBeInTheDocument();
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
    { route: "/notifications", name: "notifications" },
    { route: "/admin/users", name: "user directory" },
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

describe("notifications", () => {
  it("shows the unread count as a navigation badge that is read out, not only shown", async () => {
    renderWithSession(<AppRoutes />, { fetchImpl: platform() });
    expect(await screen.findByLabelText("Непрочитаних сповіщень: 1")).toHaveTextContent("1");
  });

  // A badge showing nothing to read would be noise.
  it("shows no badge when nothing is unread", async () => {
    const fetchImpl = platform({
      "/api/v1/notifications": { body: { ...NOTIFICATIONS, unread_count: 0 } },
    });
    renderWithSession(<AppRoutes />, { fetchImpl });
    await screen.findByRole("heading", { level: 1, name: /Вітаємо/ });
    await waitFor(() => expect(screen.queryByLabelText(/Непрочитаних сповіщень/)).not.toBeInTheDocument());
  });

  it("lists notifications with their severity and time", async () => {
    renderWithSession(<AppRoutes />, { fetchImpl: platform(), route: "/notifications" });
    expect(
      await screen.findByRole("heading", { level: 2, name: "Резервне копіювання не вдалося" }),
    ).toBeInTheDocument();
    expect(screen.getByText("nightly backup exited 1")).toBeInTheDocument();
    expect(screen.getByText(/Критично/)).toBeInTheDocument();
    expect(screen.getByText("SRV-000004")).toBeInTheDocument();
  });

  // The platform omits a link for entity types the HUB has no page for. A
  // link that leads nowhere is worse than none, so the page must not invent
  // one from the entity id.
  it("offers a link only where the platform gave one", async () => {
    renderWithSession(<AppRoutes />, { fetchImpl: platform(), route: "/notifications" });
    const list = await screen.findByRole("list", { name: "Список сповіщень" });
    const rows = within(list).getAllByRole("listitem");
    expect(within(rows[0]).queryByRole("link", { name: "Відкрити" })).not.toBeInTheDocument();
    expect(within(rows[1]).getByRole("link", { name: "Відкрити" })).toHaveAttribute(
      "href",
      "/clients/CL-000001",
    );
  });

  // Read state is per user and lives on the platform, so the page re-reads
  // rather than deciding locally what the collection now looks like.
  it("marks a notification read and re-reads the collection", async () => {
    const calls: { url: string; method: string }[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push({ url, method: init?.method ?? "GET" });
      if (url.includes("/read")) return new Response(null, { status: 204 });
      const read = calls.filter((call) => call.method === "POST").length > 0;
      return new Response(
        JSON.stringify({
          ...NOTIFICATIONS,
          data: NOTIFICATIONS.data.map((item) => (item.id === 91 ? { ...item, read } : item)),
          unread_count: read ? 0 : 1,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    renderWithSession(<AppRoutes />, { fetchImpl, route: "/notifications" });
    await userEvent.click((await screen.findAllByRole("button", { name: "Позначити прочитаним" }))[0]);

    await waitFor(() =>
      expect(calls.some((call) => call.method === "POST" && call.url.includes("/api/v1/notifications/91/read"))).toBe(
        true,
      ),
    );
    // The button disappears once the platform reports it read, and the badge
    // follows the platform's count rather than being decremented locally.
    await waitFor(() =>
      expect(screen.queryAllByRole("button", { name: "Позначити прочитаним" })).toHaveLength(0),
    );
    await waitFor(() => expect(screen.queryByLabelText(/Непрочитаних сповіщень/)).not.toBeInTheDocument());
  });

  it("filters to unread and asks the platform to do the filtering", async () => {
    const requested: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      requested.push(url);
      const unread = url.includes("unread=true");
      return new Response(
        JSON.stringify({
          ...NOTIFICATIONS,
          data: unread ? NOTIFICATIONS.data.filter((item) => !item.read) : NOTIFICATIONS.data,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    renderWithSession(<AppRoutes />, { fetchImpl, route: "/notifications" });
    await screen.findByRole("heading", { level: 2, name: "Резервне копіювання не вдалося" });
    await userEvent.click(screen.getByRole("checkbox", { name: "Лише непрочитані" }));

    await waitFor(() => expect(requested.some((url) => url.includes("unread=true"))).toBe(true));
    await waitFor(() =>
      expect(screen.queryByRole("heading", { level: 2, name: "Випуск створено" })).not.toBeInTheDocument(),
    );
  });

  // The page must not turn an empty collection into something that looks
  // broken, and the message has to say which kind of empty it is.
  it("distinguishes an empty collection from an empty filter", async () => {
    const empty = { data: [], pagination: { total: 0, limit: 0 }, unread_count: 0 };
    renderWithSession(<AppRoutes />, {
      fetchImpl: platform({ "/api/v1/notifications": { body: empty } }),
      route: "/notifications",
    });
    expect(await screen.findByText("Сповіщень немає.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Лише непрочитані" }));
    expect(await screen.findByText("Непрочитаних сповіщень немає.")).toBeInTheDocument();
  });

  // A failure to read notifications is reported on the page the user is
  // actually looking at, with the correlation id they would quote.
  it("reports a platform failure rather than showing an empty list", async () => {
    const fetchImpl = platform({
      "/api/v1/notifications": { status: 503, body: { error: "notification store unavailable" } },
    });
    renderWithSession(<AppRoutes />, { fetchImpl, route: "/notifications" });
    expect(await screen.findByRole("alert")).toHaveTextContent("notification store unavailable");
  });

  // A page keeps the cursors it was given rather than computing positions:
  // the encoding is the platform's and will change.
  it("pages with the platform's opaque cursor", async () => {
    const requested: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      requested.push(url);
      const second = url.includes("cursor=bjo5MQ");
      return new Response(
        JSON.stringify({
          data: [NOTIFICATIONS.data[second ? 1 : 0]],
          pagination: { total: 2, limit: 1, ...(second ? {} : { next_cursor: "bjo5MQ" }) },
          unread_count: 1,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    renderWithSession(<AppRoutes />, { fetchImpl, route: "/notifications" });
    await screen.findByRole("heading", { level: 2, name: "Резервне копіювання не вдалося" });
    expect(screen.getByRole("button", { name: "Назад" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Далі" }));
    await waitFor(() => expect(requested.some((url) => url.includes("cursor=bjo5MQ"))).toBe(true));
    expect(await screen.findByRole("heading", { level: 2, name: "Випуск створено" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Далі" })).toBeDisabled();
  });
});
