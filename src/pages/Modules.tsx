import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError } from "../api/client";
import type { HumanRole, LaunchOrigin, Module, ModuleAllowedOrigins, ModuleStatus } from "../api/types";
import { DataState } from "../components/DataState";
import { useResource } from "../hooks/useResource";
import { useSession } from "../session";
import { HUMAN_ROLES, ROLE_LABELS } from "../lib/roles";
import { buildLaunchUrl, splitLaunchUrl } from "../lib/moduleLaunchUrl";

const DATE_TIME = new Intl.DateTimeFormat("uk-UA", {
  dateStyle: "medium",
  timeStyle: "short",
});

const STATUS_LABELS: Record<ModuleStatus, string> = {
  active: "Активний",
  maintenance: "Технічне обслуговування",
  disabled: "Вимкнений",
};

const MODULE_STATUSES = Object.keys(STATUS_LABELS) as ModuleStatus[];

function formatDateTime(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_TIME.format(date);
}

function errorMessage(cause: unknown): string {
  if (cause instanceof ApiError) return cause.message;
  return cause instanceof Error ? cause.message : "Невідома помилка";
}

/** Derives a URL-safe id from a name, the same shape as the existing short
 * module keys (`crm`, `redmine`, `outline`). */
function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeAllowedRoles(module: Module): HumanRole[] {
  return Array.isArray(module.allowed_roles) ? module.allowed_roles : [];
}

function rolesLabel(module: Module): string {
  const roles = safeAllowedRoles(module);
  if (roles.length === 0) return "—";
  return roles.map((role) => ROLE_LABELS[role] ?? role).join(", ");
}

function RoleCheckboxes({
  selected,
  onChange,
  disabled,
}: {
  selected: HumanRole[];
  onChange: (roles: HumanRole[]) => void;
  disabled?: boolean;
}) {
  function toggle(role: HumanRole) {
    onChange(selected.includes(role) ? selected.filter((candidate) => candidate !== role) : [...selected, role]);
  }

  return (
    <fieldset className="role-checkboxes" disabled={disabled}>
      <legend>Видимо для ролей</legend>
      {HUMAN_ROLES.map((role) => (
        <label key={role} className="checkbox-label">
          <input type="checkbox" checked={selected.includes(role)} onChange={() => toggle(role)} />
          {ROLE_LABELS[role]}
        </label>
      ))}
    </fieldset>
  );
}

/** Origin + path controls for a module's launch URL — shared between create
 * and edit so the two forms can't drift apart on how a launch URL is
 * assembled (see ADR-006 / `buildLaunchUrl`). */
function LaunchUrlFields({
  origins,
  origin,
  path,
  onOriginChange,
  onPathChange,
  disabled,
}: {
  origins: LaunchOrigin[];
  origin: LaunchOrigin;
  path: string;
  onOriginChange: (origin: LaunchOrigin) => void;
  onPathChange: (path: string) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <label>
        Джерело (canonical origin)
        <select value={origin} disabled={disabled} onChange={(event) => onOriginChange(event.target.value)}>
          <option value="">Без посилання запуску</option>
          {origins.map((candidate) => (
            <option key={candidate} value={candidate}>
              {candidate}
            </option>
          ))}
        </select>
      </label>
      <label>
        Шлях (необовʼязково)
        <input
          value={path}
          disabled={disabled || !origin}
          placeholder="issues/42"
          onChange={(event) => onPathChange(event.target.value)}
        />
      </label>
      {origins.length === 0 && (
        <p className="muted">Платформа не повернула дозволені джерела — посилання запуску недоступне.</p>
      )}
    </>
  );
}

function CreateModule({ origins, onCreated }: { origins: LaunchOrigin[]; onCreated: () => void }) {
  const { api } = useSession();
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [idTouched, setIdTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [origin, setOrigin] = useState("");
  const [path, setPath] = useState("");
  const [roles, setRoles] = useState<HumanRole[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function onNameChange(value: string) {
    setName(value);
    if (!idTouched) setId(slugify(value));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      await api.request<Module>("/api/v1/admin/modules", {
        method: "POST",
        body: {
          id,
          name,
          description,
          status: "disabled",
          launch_url: buildLaunchUrl(origin, path, origins),
          allowed_roles: roles,
        },
      });
      setName("");
      setId("");
      setIdTouched(false);
      setDescription("");
      setOrigin("");
      setPath("");
      setRoles([]);
      setMessage("Додаток створено як вимкнений — активуйте його нижче в списку, коли налаштування завершено.");
      onCreated();
    } catch (cause) {
      setMessage(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="admin-panel">
      <summary>+ Додати додаток</summary>
      <form className="admin-form" onSubmit={(event) => void submit(event)}>
        <label>
          Назва
          <input required value={name} onChange={(event) => onNameChange(event.target.value)} />
        </label>
        <label>
          Ідентифікатор
          <input
            required
            pattern="[a-z0-9-]+"
            value={id}
            onChange={(event) => {
              setIdTouched(true);
              setId(event.target.value);
            }}
          />
        </label>
        <label>
          Опис
          <input required value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <LaunchUrlFields origins={origins} origin={origin} path={path} onOriginChange={setOrigin} onPathChange={setPath} />
        <RoleCheckboxes selected={roles} onChange={setRoles} />
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

function ModuleActions({
  module,
  origins,
  onChanged,
}: {
  module: Module;
  origins: LaunchOrigin[];
  onChanged: () => void;
}) {
  const { api } = useSession();
  const [name, setName] = useState(module.name);
  const [description, setDescription] = useState(module.description);
  const [status, setStatus] = useState<ModuleStatus>(module.status);
  const initialLaunch = useMemo(() => splitLaunchUrl(module.launch_url, origins), [module.launch_url, origins]);
  const [origin, setOrigin] = useState<LaunchOrigin>(initialLaunch.origin);
  const [path, setPath] = useState(initialLaunch.path);
  // `origins` loads asynchronously and typically resolves after this
  // component has already mounted (with `origins` still `[]`), so the
  // useState initializers above usually run before there's anything for
  // splitLaunchUrl to match against. Re-sync once origins actually arrive —
  // but only then: once populated, `initialLaunch` only changes again if the
  // server's own `module.launch_url` changes, not on every re-render, so
  // this does not clobber an in-progress edit.
  useEffect(() => {
    setOrigin(initialLaunch.origin);
    setPath(initialLaunch.path);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately keyed on the derived primitives, not `origins`/`module` identity
  }, [initialLaunch.origin, initialLaunch.path]);
  const [roles, setRoles] = useState<HumanRole[]>(safeAllowedRoles(module));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // A module the spec forbids activating without roles assigned first — the
  // create form always sends "disabled" regardless, so this is the only
  // point that could otherwise put a module live with nobody able to see it.
  const activatingWithoutRoles = status === "active" && roles.length === 0;

  async function patch(body: Partial<Pick<Module, "name" | "description" | "status" | "allowed_roles" | "launch_url">>) {
    setBusy(true);
    setMessage(null);
    try {
      await api.request<Module>(`/api/v1/admin/modules/${module.id}`, { method: "PATCH", body });
      setMessage("Збережено.");
      onChanged();
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
          Назва
          <input value={name} disabled={busy} onChange={(event) => setName(event.target.value)} />
        </label>
        <button
          type="button"
          disabled={busy || name.trim() === ""}
          onClick={() => void patch({ name: name.trim() })}
        >
          Зберегти назву
        </button>
        <label>
          Опис
          <input value={description} disabled={busy} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <button
          type="button"
          disabled={busy || description.trim() === ""}
          onClick={() => void patch({ description: description.trim() })}
        >
          Зберегти опис
        </button>
        <LaunchUrlFields
          origins={origins}
          origin={origin}
          path={path}
          onOriginChange={setOrigin}
          onPathChange={setPath}
          disabled={busy}
        />
        <button
          type="button"
          // Requires a picked origin: sending `launch_url: undefined` would
          // be dropped from the JSON body entirely and silently do nothing,
          // which would read as a successful clear it isn't. Removing a
          // launch URL isn't a case this form supports.
          disabled={busy || !origin || !buildLaunchUrl(origin, path, origins)}
          onClick={() => void patch({ launch_url: buildLaunchUrl(origin, path, origins) })}
        >
          Зберегти посилання
        </button>
        <label>
          Статус
          <select value={status} disabled={busy} onChange={(event) => setStatus(event.target.value as ModuleStatus)}>
            {MODULE_STATUSES.map((candidate) => (
              <option key={candidate} value={candidate}>
                {STATUS_LABELS[candidate]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={busy || activatingWithoutRoles} onClick={() => void patch({ status })}>
          Зберегти статус
        </button>
        {activatingWithoutRoles && (
          <p className="muted">Спершу призначте ролі нижче — активний модуль без жодної ролі ніхто не побачить.</p>
        )}
        <RoleCheckboxes selected={roles} onChange={setRoles} disabled={busy} />
        <button type="button" disabled={busy} onClick={() => void patch({ allowed_roles: roles })}>
          Зберегти ролі
        </button>
        {message && <span role="status">{message}</span>}
      </div>
    </details>
  );
}

export function Modules() {
  const { api, can } = useSession();
  const state = useResource<Module[]>((signal) => api.request<Module[]>("/api/v1/admin/modules", { signal }), [api]);
  const originsState = useResource<ModuleAllowedOrigins>(
    (signal) => api.request<ModuleAllowedOrigins>("/api/v1/admin/modules/allowed-origins", { signal }),
    [api],
  );
  const origins = useMemo(
    () => (originsState.status === "ready" ? originsState.data.origins : []),
    [originsState],
  );
  const canManage = can("module.admin");

  return (
    <section aria-labelledby="modules-admin-heading">
      <h1 id="modules-admin-heading">Модулі</h1>
      <p className="muted">
        Каталог додатків, підключених через центральний SSO (authentik). HUB лише показує і запускає модулі —
        авторизацію виконує кожен модуль самостійно.
      </p>
      <DataState state={state} onRetry={state.reload}>
        {(modules) => (
          <>
            {/* Deliberately outside the empty/non-empty branch below: an
                admin with no modules yet must still be able to create the
                first one. DataState's `isEmpty`/`empty` props would replace
                this whole children render with the empty message instead,
                hiding the create form exactly when it is needed most. */}
            {canManage && <CreateModule origins={origins} onCreated={state.reload} />}
            {modules.length === 0 ? (
              <p>Додатків ще немає.</p>
            ) : (
            <div className="table-scroll">
              <table className="entity-table">
                <caption>Каталог модулів BSYSTEM</caption>
                <thead>
                  <tr>
                    <th scope="col">Додаток</th>
                    <th scope="col">Ідентифікатор</th>
                    <th scope="col">Статус</th>
                    <th scope="col">Ролі з доступом</th>
                    <th scope="col">Оновлено</th>
                    {canManage && <th scope="col">Дії</th>}
                  </tr>
                </thead>
                <tbody>
                  {modules.map((module) => (
                    <tr key={module.id}>
                      <td>{module.name}</td>
                      <td>
                        <code>{module.id}</code>
                      </td>
                      <td>{STATUS_LABELS[module.status] ?? module.status}</td>
                      <td>{rolesLabel(module)}</td>
                      <td>
                        {formatDateTime(module.updated_at)}
                        {module.updated_by && <span className="muted"> · {module.updated_by}</span>}
                      </td>
                      {canManage && (
                        <td>
                          <ModuleActions module={module} origins={origins} onChanged={state.reload} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </>
        )}
      </DataState>
    </section>
  );
}
