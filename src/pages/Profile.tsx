import { useSession } from "../session";

export function Profile() {
  const { me } = useSession();
  if (!me) return null;

  return (
    <section aria-labelledby="profile-heading">
      <h1 id="profile-heading">Профіль</h1>

      <dl className="definitions">
        <dt>Global ID</dt>
        <dd>
          <code>{me.id}</code>
        </dd>
        <dt>Ім'я</dt>
        <dd>{me.name || "—"}</dd>
        <dt>Логін</dt>
        <dd>{me.username || "—"}</dd>
        <dt>Пошта</dt>
        <dd>{me.email || "—"}</dd>
        <dt>Ідентифікатор в authentik</dt>
        <dd>
          <code>{me.subject}</code>
        </dd>
      </dl>

      <h2>Групи</h2>
      <TagList values={me.groups} empty="Користувач не входить до жодної групи." />

      <h2>Ролі</h2>
      <TagList values={me.roles} empty="Групи користувача не зіставлені з жодною роллю BSYSTEM." />

      <h2>Дозволи</h2>
      <TagList values={me.permissions} empty="Ролі користувача не надають жодного дозволу." />
    </section>
  );
}

// F-01: /api/v1/me's contract promises groups/roles/permissions: string[],
// but a runtime response is not guaranteed to keep that promise — matches
// the Array.isArray guard Users.tsx already uses for the same class of
// field. Malformed data degrades to the empty state, never to a
// default/invented value.
function TagList({ values, empty }: { values: string[]; empty: string }) {
  const safeValues = Array.isArray(values) ? values : [];
  if (safeValues.length === 0) return <p className="muted">{empty}</p>;
  return (
    <ul className="tag-list" role="list">
      {safeValues.map((value) => (
        <li key={value}>
          <span className="status">{value}</span>
        </li>
      ))}
    </ul>
  );
}
