import { useEffect, useMemo, useState } from "react";
import { apiFetch, completeLogin, getUser, login, logout, oidcConfigured } from "./auth";

type Me = {
  id: string;
  subject: string;
  email: string;
  name: string;
  username: string;
  groups: string[];
  roles: string[];
  permissions: string[];
  modules: string[];
};

type Module = {
  id: string;
  name: string;
  description: string;
  status: string;
};

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isCallback = useMemo(() => window.location.pathname === "/auth/callback", []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        if (!oidcConfigured) {
          if (active) setError("OIDC ще не налаштований. Вкажіть VITE_OIDC_AUTHORITY та VITE_OIDC_CLIENT_ID.");
          return;
        }

        if (isCallback) {
          await completeLogin();
          window.history.replaceState({}, document.title, "/");
        }

        const user = await getUser();
        if (!user || user.expired) return;

        const [meResponse, modulesResponse] = await Promise.all([
          apiFetch("/api/v1/me"),
          apiFetch("/api/v1/modules"),
        ]);

        if (meResponse.status === 401) {
          await logout();
          return;
        }
        if (!meResponse.ok || !modulesResponse.ok) {
          throw new Error("Integration Core повернув помилку");
        }

        if (!active) return;
        setMe(await meResponse.json());
        setModules(await modulesResponse.json());
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Невідома помилка авторизації");
      } finally {
        if (active) setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, [isCallback]);

  if (loading) {
    return <main className="center"><p>BSYSTEM-HUB · перевірка сесії…</p></main>;
  }

  if (!me) {
    return (
      <main className="center login-screen">
        <p className="eyebrow">BSYSTEM PLATFORM</p>
        <h1>Єдиний простір для роботи</h1>
        <p>Авторизація виконується централізовано через authentik.</p>
        {error && <div className="notice warning">{error}</div>}
        <button className="primary" onClick={() => void login()} disabled={!oidcConfigured}>
          Увійти через BSYSTEM Identity
        </button>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <strong>BSYSTEM HUB</strong>
          <span> P0.1 Identity & RBAC</span>
        </div>
        <nav>Dashboard · Search · Notifications · Profile</nav>
        <div className="userbox">
          <span>{me.name || me.username}</span>
          <button className="link-button" onClick={() => void logout()}>Вийти</button>
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">BSYSTEM PLATFORM</p>
        <h1>Вітаємо, {me.name || me.username}</h1>
        <p>Доступ формується з груп authentik та RBAC-політик BSYSTEM-HUB.</p>
        <div className="identity-row">
          <span className="status">{me.email}</span>
          {me.roles.map((role) => <span className="status role" key={role}>{role}</span>)}
        </div>
      </section>

      {modules.length === 0 ? (
        <section className="empty-state">
          <h2>Немає доступних модулів</h2>
          <p>Користувач автентифікований, але його групи ще не зіставлені з ролями BSYSTEM.</p>
        </section>
      ) : (
        <section className="grid" aria-label="Доступні модулі BSYSTEM">
          {modules.map((item) => (
            <article className="card" key={item.id}>
              <h2>{item.name}</h2>
              <p>{item.description}</p>
              <span className="status">{item.status}</span>
            </article>
          ))}
        </section>
      )}

      <footer>
        Identity: authentik · Authorization: BSYSTEM RBAC · API: Integration Core
      </footer>
    </main>
  );
}
