import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

/**
 * Catches an otherwise-uncaught render error anywhere below it and shows a
 * recovery screen instead of leaving React unmount the whole tree to a blank
 * page (REM-2). Deliberately does not report the error anywhere (no
 * console logging, no error-reporting service) — that is a separate,
 * optional concern (see .unlazy/audit/REMEDIATION.md REM-22) and out of
 * scope for this fix.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  // Required by React's error boundary contract even though this
  // implementation intentionally does nothing with the error — see the
  // class comment for why no reporting is wired here.
  componentDidCatch(_error: Error, _info: ErrorInfo): void {}

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="center login-screen" role="alert">
          <p className="eyebrow">BSYSTEM-HUB</p>
          <h1>Щось пішло не так</h1>
          <p>Сторінку не вдалося показати. Спробуйте перезавантажити.</p>
          <button type="button" className="primary" onClick={this.handleReload}>
            Перезавантажити
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
