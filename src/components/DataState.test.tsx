import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiError } from "../api/client";
import { DataState, ErrorState } from "./DataState";

/**
 * The failure states a reader can be in, and whether the HUB tells them apart.
 *
 * DataState's own contract says the distinctions matter: "you may not see
 * this" is a different answer from "there is nothing here", and "the source
 * system is down" is different again from "the platform is broken".
 * Collapsing them leaves a reader unable to tell whether to retry, to ask for
 * access, or to wait.
 *
 * The statuses and codes asserted here are the ones bsystem-integration-core
 * actually answers with, pinned on its side by cmd/server/adapter_resolution_test.go.
 */

function failure(init: { status: number; message?: string; code?: string; source?: string }): ApiError {
  return new ApiError({
    status: init.status,
    message: init.message ?? "platform summary",
    code: init.code,
    source: init.source,
  });
}

describe("ErrorState", () => {
  it("names a refusal as a refusal rather than a failure", () => {
    render(<ErrorState error={failure({ status: 403, code: "permission_required" })} />);
    expect(screen.getByRole("heading")).toHaveTextContent("Немає доступу");
  });

  it("names a missing resource without suggesting the platform broke", () => {
    render(<ErrorState error={failure({ status: 404, code: "not_found" })} />);
    expect(screen.getByRole("heading")).toHaveTextContent("Не знайдено");
  });

  it("blames the source system when the source system is what failed", () => {
    render(<ErrorState error={failure({ status: 502, code: "upstream_unavailable", source: "espocrm" })} />);
    expect(screen.getByRole("heading")).toHaveTextContent("Джерельна система недоступна");
    expect(screen.getByText(/espocrm/)).toBeInTheDocument();
  });

  // The case that motivated this file. A deployment may deliberately leave an
  // integration out — docs/STAGE-ACCEPTANCE.md in bsystem-deploy invites
  // accepting the CRM path with Redmine left out — so this is the failure a
  // reader meets most often on a stage deployment, and it is not a failure at
  // all. Rendering it as a bare "Помилка" reports a supported configuration as
  // a fault and leaves the reader nothing to act on.
  it("tells a reader an integration is simply not connected here", () => {
    render(
      <ErrorState
        error={failure({
          status: 503,
          code: "adapter_not_configured",
          source: "redmine",
          message: "Redmine adapter not configured",
        })}
      />,
    );

    const heading = screen.getByRole("heading");
    expect(heading).toHaveTextContent("Інтеграцію не налаштовано");
    expect(heading).not.toHaveTextContent("Помилка");
    expect(screen.getByText(/не підключено в цьому середовищі/)).toBeInTheDocument();
    // Which integration is missing is the one thing that makes this
    // actionable, so it has to be on screen.
    expect(screen.getByText(/redmine/)).toBeInTheDocument();
  });

  it("separates an integration that cannot do this from one that is absent", () => {
    render(
      <ErrorState
        error={failure({ status: 503, code: "capability_unsupported", source: "outline" })}
      />,
    );

    expect(screen.getByRole("heading")).toHaveTextContent("Інтеграція не підтримує цю дію");
    // Configuring it differently will not help, so the text must not send the
    // reader off to change a setting.
    expect(screen.queryByText(/не підключено в цьому середовищі/)).not.toBeInTheDocument();
  });

  // A 503 the platform did not explain is a platform dependency, such as the
  // database. That one really is "wait", and it is the only 503 that should
  // read that way.
  it("treats an unexplained 503 as the platform being down", () => {
    render(<ErrorState error={failure({ status: 503, message: "RBAC store unavailable" })} />);
    expect(screen.getByRole("heading")).toHaveTextContent("Платформа тимчасово недоступна");
  });

  it("falls back to the platform's own summary when it defines no code", () => {
    render(<ErrorState error={failure({ status: 500, message: "щось пішло не так" })} />);
    expect(screen.getByRole("heading")).toHaveTextContent("Помилка");
    expect(screen.getByText("щось пішло не так")).toBeInTheDocument();
  });

  // Every failure state has to be announced, not merely drawn: a reader using
  // a screen reader gets no title otherwise.
  it("announces the failure", () => {
    render(<ErrorState error={failure({ status: 503, code: "adapter_not_configured" })} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("carries the correlation id, which is how a report is traced", () => {
    render(
      <ErrorState
        error={
          new ApiError({ status: 502, message: "upstream service unavailable", requestId: "req-42" })
        }
      />,
    );
    expect(screen.getByText("req-42")).toBeInTheDocument();
  });
});

describe("DataState", () => {
  it("shows an empty result as empty, never as a failure", () => {
    render(
      <DataState
        state={{ status: "ready", data: [] as string[], error: null }}
        isEmpty={(data) => data.length === 0}
        empty={<p>Немає даних для показу.</p>}
      >
        {() => <p>never rendered</p>}
      </DataState>,
    );

    expect(screen.getByText("Немає даних для показу.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // An unconfigured integration must not arrive here as an empty list. It
  // answers 503, so it reaches the error branch — and the distinction is the
  // whole point: an empty collection would tell a reader the platform knows of
  // no records, when the truth is that nobody has told it where to look.
  it("does not let an unconfigured integration look like no data", () => {
    render(
      <DataState
        state={{
          status: "error",
          data: null,
          error: failure({ status: 503, code: "adapter_not_configured", source: "espocrm" }),
        }}
        isEmpty={() => true}
      >
        {() => <p>never rendered</p>}
      </DataState>,
    );

    expect(screen.queryByText("Немає даних для показу.")).not.toBeInTheDocument();
    expect(screen.getByRole("heading")).toHaveTextContent("Інтеграцію не налаштовано");
  });

  it("announces loading rather than showing a blank page", () => {
    render(
      <DataState state={{ status: "loading", data: null, error: null }}>{() => <p>data</p>}</DataState>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Завантаження…");
  });
});
