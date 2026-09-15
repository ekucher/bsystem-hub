const modules = [
  ["CRM", "Клієнти, контакти, договори та сервіси"],
  ["Projects", "Проєкти й задачі Redmine"],
  ["QA", "Тест-кейси, запуски та дефекти"],
  ["Development", "Репозиторії, CI/CD та релізи"],
  ["Wiki", "Документація та Runbooks"],
  ["Operations", "BRAVO, сервери, backup та події"],
];

export default function App() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <strong>BSYSTEM HUB</strong>
          <span> P0 Foundation</span>
        </div>
        <nav>Dashboard · Search · Notifications · Profile</nav>
      </header>

      <section className="hero">
        <p className="eyebrow">BSYSTEM PLATFORM</p>
        <h1>Єдиний простір для роботи</h1>
        <p>SSO, навігація, RBAC, інтеграції та контрольований доступ до модулів екосистеми.</p>
      </section>

      <section className="grid" aria-label="Модулі BSYSTEM">
        {modules.map(([name, description]) => (
          <article className="card" key={name}>
            <h2>{name}</h2>
            <p>{description}</p>
            <span className="status">P0 · integration pending</span>
          </article>
        ))}
      </section>

      <footer>
        Identity: authentik · API: Integration Core · Deployment: Docker
      </footer>
    </main>
  );
}
