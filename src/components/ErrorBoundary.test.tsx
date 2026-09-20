import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

function Bomb(): never {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  it("renders a fallback instead of a blank page when a child throws", () => {
    // React logs the caught error to the console by default; suppress that
    // expected noise for this test only.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Щось пішло не так")).toBeInTheDocument();
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument();

    consoleError.mockRestore();
  });

  it("renders children normally when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("all good")).toBeInTheDocument();
  });

  it("offers a reload action that reloads the page", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload },
    });

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Перезавантажити" }));
    expect(reload).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    consoleError.mockRestore();
  });
});
