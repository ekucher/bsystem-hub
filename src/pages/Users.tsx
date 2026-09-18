import { useMemo, useState, type FormEvent } from "react";
import { ApiError } from "../api/client";
import type { HumanAccount, HumanAccountList, HumanRole } from "../api/types";
import { DataState } from "../components/DataState";
import { useResource } from "../hooks/useResource";
import { useSession } from "../session";

const DATE_TIME = new Intl.DateTimeFormat("uk-UA", {
  dateStyle: "medium",
  timeStyle: "short",
});

const ROLE_LABELS: Record<HumanRole, string> = {
  admin: "Адміністратор",
  manager: "Менеджер",
  developer: "Розробник",
  qa: "QA",
  support: "Підтримка",
  devops: "DevOps",
  customer: "Клієнт",
};

const HUMAN_ROLES = Object.keys(ROLE_LABELS) as HumanRole[];

function formatDateTime(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_TIME.format(date);
}

function errorMessage(cause: unknown): string {
  if (cause instanceof ApiError) return cause.message;
  return cause instanceof Error ? cause.message : "Невідома помилка";
}

function roleLabel(account: HumanAccount): string {
  if (account.roles.length === 0) return "—";
  return account.roles.map((role) => ROLE_LABELS[role] ?? role).join(", ");
}

function statusLabel(account: HumanAccount): string {
  if (account.active === undefined) return "Невідомо";
  return account.active ? "Активний" : "Вимкнений";
}

function CreateAccount({
  onCreated,
  canAdmin,
}: {
  onCreated: () => void;
  canAdmin: boolean;
}) {
  const { api } = useSession();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<HumanRole>("customer");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const roleOptions = useMemo(
    () => HUMAN_ROLES.filter((candidate) => canAdmin || candidate !== "admin"),
    [canAdmin],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (password !== passwordAgain) {
      setMessage("Паролі не збігаються.");
      return;
    }
    setBusy(true);
    try {
      await api.request<HumanAccount>("/api/v1/admin/accounts", {
        method: "POST",
        body: { username, name, email, role, password },
      });
      setUsername("");
      setName("");
      setEmail("");
      setRole("customer");
      setPassword("");
      setPasswordAgain("");
      setMessage("Користувача створено.");
      onCreated();
    } catch (cause) {
      setMessage(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="admin-panel">
      <summary>+ Створити користувача</summary>
      <form className="admin-form" onSubmit={(event) => void submit(event)}>
        <label>
          Логін
          <input
            name="username"
            autoComplete="off"
            required
            pattern="[A-Za-z0-9._@-]+"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label>
          Імʼя
          <input name="name" required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Пошта
          <input name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Роль
          <select value={role} onChange={(event) => setRole(event.target.value as HumanRole)}>
            {roleOptions.map((candidate) => (
              <option key={candidate} value={candidate}>
                {ROLE_LABELS[candidate]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Пароль
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label>
          Повторіть пароль
          <input
            name="password-again"
            type="password"
            autoComplete="new-password"
            required
            value={passwordAgain}
            onChange={(event) => setPasswordAgain(event.target.value)}
          />
        </label>
        <div className="row-actions">
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Створення…" : "Створити"}
          </button>
          {message && <span role="status">{message}</span>}
        </div>
      </form>
    </details>
  );
}

function AccountActions({
  account,
  canAdmin,
  onChanged,
}: {
  account: HumanAccount;
  canAdmin: boolean;
  onChanged: () => void;
}) {
  const { api } = useSession();
  const [email, setEmail] = useState(account.email);
  const [role, setRole] = useState<HumanRole>(account.roles[0] ?? "customer");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const adminTarget = account.roles.includes("admin");
  const canMutateTarget = account.manageable && (!adminTarget || canAdmin);
  const roleOptions = HUMAN_ROLES.filter((candidate) => canAdmin || candidate !== "admin");

  if (!account.authentik_id || !canMutateTarget) {
    return <span className="muted">{adminTarget && !canAdmin ? "Лише адміністратор" : "Недоступно"}</span>;
  }

  async function patch(body: { email?: string; role?: HumanRole; active?: boolean }) {
    setBusy(true);
    setMessage(null);
    try {
      await api.request<HumanAccount>(`/api/v1/admin/accounts/${account.authentik_id}`, {
        method: "PATCH",
        body,
      });
      setMessage("Збережено.");
      if (body.email !== undefined) {
        setEmail(body.email.trim());
      }
      onChanged();
    } catch (cause) {
      setMessage(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (password !== passwordAgain) {
      setMessage("Паролі не збігаються.");
      return;
    }
    setBusy(true);
    try {
      await api.request<void>(`/api/v1/admin/accounts/${account.authentik_id}/password`, {
        method: "POST",
        body: { password },
      });
      setPassword("");
      setPasswordAgain("");
      setMessage("Пароль змінено.");
    } catch (cause) {
      setMessage(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="account-actions">
      <summary>Керувати</summary>
      <div className="account-action-grid">
        <label>
          Пошта
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
          />
        </label>
        <button type="button" disabled={busy || email.trim() === ""} onClick={() => void patch({ email: email.trim() })}>
          Зберегти пошту
        </button>
        <label>
          Роль
          <select value={role} onChange={(event) => setRole(event.target.value as HumanRole)} disabled={busy}>
            {roleOptions.map((candidate) => (
              <option key={candidate} value={candidate}>
                {ROLE_LABELS[candidate]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={busy} onClick={() => void patch({ role })}>
          Зберегти роль
        </button>
        {account.active !== undefined && (
          <button type="button" disabled={busy} onClick={() => void patch({ active: !account.active })}>
            {account.active ? "Вимкнути" : "Увімкнути"}
          </button>
        )}
        {account.password_manageable && (
          <form className="password-form" onSubmit={(event) => void resetPassword(event)}>
            <label>
              Новий пароль
              <input
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label>
              Повторіть пароль
              <input
                type="password"
                autoComplete="new-password"
                required
                value={passwordAgain}
                onChange={(event) => setPasswordAgain(event.target.value)}
              />
            </label>
            <button type="submit" disabled={busy}>
              Змінити пароль
            </button>
          </form>
        )}
        {message && <span role="status">{message}</span>}
      </div>
    </details>
  );
}

export function Users() {
  const { api, can } = useSession();
  const state = useResource<HumanAccountList>(
    (signal) => api.request<HumanAccountList>("/api/v1/admin/accounts", { signal }),
    [api],
  );
  const canManage = can("identity.user.manage");
  const canAdmin = can("identity.user.admin");

  return (
    <section aria-labelledby="users-heading">
      <h1 id="users-heading">Користувачі</h1>
      <p className="muted">
        Authentik керує обліковими даними та активацією. Integration Core зберігає незмінний Global User ID після першого успішного входу.
      </p>
      <DataState
        state={state}
        isEmpty={(value) => value.accounts.length === 0}
        empty={<p>Користувачів ще немає.</p>}
      >
        {(value) => (
          <>
            {!value.management_available && (
              <p className="notice warning">
                Керування Authentik не налаштовано. Доступний лише перегляд уже відомих Integration Core ідентичностей.
              </p>
            )}
            {value.management_available && canManage && <CreateAccount onCreated={state.reload} canAdmin={canAdmin} />}
            <div className="table-scroll">
              <table className="entity-table">
                <caption>Користувачі BSYSTEM та їхні Global ID</caption>
                <thead>
                  <tr>
                    <th scope="col">Користувач</th>
                    <th scope="col">Логін</th>
                    <th scope="col">Global ID</th>
                    <th scope="col">Пошта</th>
                    <th scope="col">Роль</th>
                    <th scope="col">Стан</th>
                    <th scope="col">Останній вхід</th>
                    {canManage && value.management_available && <th scope="col">Дії</th>}
                  </tr>
                </thead>
                <tbody>
                  {value.accounts.map((account) => (
                    <tr key={account.global_id ?? `ak-${account.authentik_id ?? account.username}`}>
                      <td>{account.name || account.username}</td>
                      <td><code>{account.username}</code></td>
                      <td>{account.global_id ? <code>{account.global_id}</code> : <span className="muted">До першого входу</span>}</td>
                      <td>{account.email || "—"}</td>
                      <td>{roleLabel(account)}</td>
                      <td>{statusLabel(account)}</td>
                      <td>{formatDateTime(account.last_seen_at)}</td>
                      {canManage && value.management_available && (
                        <td>
                          <AccountActions account={account} canAdmin={canAdmin} onChanged={state.reload} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DataState>
    </section>
  );
}
