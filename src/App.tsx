import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Profile } from "./pages/Profile";
import { Clients, Documents, Issues, Projects } from "./pages/Collections";
import { ClientDetail, ProjectDetail } from "./pages/Details";
import { Notifications } from "./pages/Notifications";
import { Forbidden, NotFound } from "./pages/Status";
import { NotificationsProvider } from "./notifications";
import { SessionProvider, useSession } from "./session";

/**
 * Routes are declared once here.
 *
 * A route requiring a permission is guarded, but the guard is a courtesy to
 * the reader: the Integration Core enforces authorization on every request,
 * and it would refuse the data even if the HUB rendered the page.
 */
export function AppRoutes() {
  return (
    // The provider wraps the routes rather than the application, so the
    // navigation badge and the notification centre share one count.
    <NotificationsProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          {/* No guard: the platform decides per notification what this user may
              read, so there is no single permission to check here. */}
          <Route path="notifications" element={<Notifications />} />
          <Route
            path="clients"
            element={
              <RequirePermission permission="crm.client.read">
                <Clients />
              </RequirePermission>
            }
          />
          <Route
            path="clients/:id"
            element={
              <RequirePermission permission="crm.client.read">
                <ClientDetail />
              </RequirePermission>
            }
          />
          <Route
            path="projects"
            element={
              <RequirePermission permission="projects.task.read">
                <Projects />
              </RequirePermission>
            }
          />
          <Route
            path="projects/:id"
            element={
              <RequirePermission permission="projects.task.read">
                <ProjectDetail />
              </RequirePermission>
            }
          />
          <Route
            path="issues"
            element={
              <RequirePermission permission="projects.task.read">
                <Issues />
              </RequirePermission>
            }
          />
          <Route
            path="documents"
            element={
              <RequirePermission permission="wiki.document.read">
                <Documents />
              </RequirePermission>
            }
          />
          <Route path="auth/callback" element={<Navigate to="/" replace />} />
          <Route path="403" element={<Forbidden />} />
          <Route path="404" element={<NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </NotificationsProvider>
  );
}

function RequirePermission({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { can } = useSession();
  return can(permission) ? <>{children}</> : <Navigate to="/403" replace />;
}

/** Decides between the sign-in screen and the application. */
export function AppContent() {
  const { status, error, configured, signIn } = useSession();

  if (status === "loading") {
    return (
      <main className="center">
        <p role="status">BSYSTEM-HUB · перевірка сесії…</p>
      </main>
    );
  }

  if (status === "authenticated") {
    return <AppRoutes />;
  }

  return (
    <main className="center login-screen">
      <p className="eyebrow">BSYSTEM PLATFORM</p>
      <h1>Єдиний простір для роботи</h1>
      <p>Авторизація виконується централізовано через authentik.</p>
      {error && (
        <div className="notice warning" role="alert">
          {error}
        </div>
      )}
      <button type="button" className="primary" onClick={signIn} disabled={!configured}>
        Увійти через BSYSTEM Identity
      </button>
    </main>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </SessionProvider>
  );
}
