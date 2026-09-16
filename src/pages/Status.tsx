import { Link } from "react-router-dom";

/** Shown when the platform refuses a page the HUB offered. */
export function Forbidden() {
  return (
    <section className="state state-error">
      <h1>Немає доступу</h1>
      <p>Ваші ролі не надають дозволу на цей розділ. Доступ визначає BSYSTEM RBAC, а не інтерфейс.</p>
      <Link to="/">Повернутися на огляд</Link>
    </section>
  );
}

/** Shown for a route the HUB does not serve. */
export function NotFound() {
  return (
    <section className="state state-empty">
      <h1>Сторінку не знайдено</h1>
      <p>Такої адреси в BSYSTEM HUB немає.</p>
      <Link to="/">Повернутися на огляд</Link>
    </section>
  );
}
