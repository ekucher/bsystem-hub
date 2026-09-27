import { NavLink, Outlet } from "react-router-dom";
import { useSession } from "../session";
import { useNotifications } from "../notifications";

type NavItem = { to: string; label: string; permission?: string };

/**
 * Navigation is filtered by the permissions the platform resolved for the
 * user, so the HUB does not offer a destination that would refuse them.
 *
 * This is presentation only. The Integration Core enforces authorization on
 * every request, and a hidden link is never the reason something is
 * protected.
 */
const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Огляд" },
  { to: "/clients", label: "Клієнти", permission: "crm.client.read" },
  { to: "/projects", label: "Проєкти", permission: "projects.task.read" },
  { to: "/issues", label: "Задачі", permission: "projects.task.read" },
  { to: "/documents", label: "Документи", permission: "wiki.document.read" },
  // No permission: what a user may read is decided per notification by
  // the platform, so there is nothing to hide the link behind.
  { to: "/notifications", label: "Сповіщення" },
  { to: "/admin/users", label: "Користувачі", permission: "identity.user.read" },
  { to: "/admin/modules", label: "Модулі", permission: "module.admin" },
  { to: "/profile", label: "Профіль" },
];

export function AppShell() {
  const { me, can, signOut } = useSession();
  const { unreadCount } = useNotifications();
  const items = NAV_ITEMS.filter((item) => !item.permission || can(item.permission));

  return (
    <div className="shell">
      {/* A keyboard user must be able to reach the page content without
          tabbing through the whole navigation on every route. */}
      <a className="skip-link" href="#main">
        Перейти до основного вмісту
      </a>

      <header className="topbar">
        <div className="brand">
          <strong>BSYSTEM HUB</strong>
        </div>
        <nav aria-label="Основна навігація">
          <ul>
            {items.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.to === "/"}>
                  {item.label}
                  {item.to === "/notifications" && unreadCount > 0 && (
                    /* The count is read out as well as shown: a badge that is
                       only a coloured dot tells a screen reader nothing. */
                    <span className="badge" aria-label={`Непрочитаних сповіщень: ${unreadCount}`}>
                      {unreadCount}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="userbox">
          {me && <span>{me.name || me.username}</span>}
          <button type="button" className="link-button" onClick={signOut}>
            Вийти
          </button>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>

      <footer>Identity: authentik · Authorization: BSYSTEM RBAC · API: Integration Core</footer>
    </div>
  );
}
