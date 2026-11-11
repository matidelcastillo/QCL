import { Link, useRouterState } from "@tanstack/react-router";

const items = [
  { to: "/", label: "Libros", icon: BookIcon },
  { to: "/agregar", label: "Buscar", icon: SearchIcon },
  { to: "/vos", label: "Vos", icon: PersonIcon },
] as const;

export function AppNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="qcl-nav-wrap">
      <nav
        className="app-bottom-nav glass glass-blur-in glass-orange-treatment glass-orange-nav-material sheen-top"
        aria-label="Principal"
      >
        {items.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className="qcba-nav-btn qcl-nav-item"
            >
              <span className="nav-ripple-clip">
                <Icon active={active} />
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function BookIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 4.75h9.25A2.25 2.25 0 0 1 17.5 7v12.25H7.5A1.75 1.75 0 0 1 5.75 17.5V6A1.25 1.25 0 0 1 7 4.75"
        stroke="currentColor"
        strokeWidth={active ? "2.2" : "1.7"}
        strokeLinejoin="round"
      />
      <path
        d="M7.5 19.25h10"
        stroke="currentColor"
        strokeWidth={active ? "2.2" : "1.7"}
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="10.5"
        cy="10.5"
        r="4.75"
        stroke="currentColor"
        strokeWidth={active ? "2.2" : "1.7"}
      />
      <path
        d="M14.25 14.25 18.25 18.25"
        stroke="currentColor"
        strokeWidth={active ? "2.2" : "1.7"}
        strokeLinecap="round"
      />
    </svg>
  );
}

function PersonIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="9" r="3.25" stroke="currentColor" strokeWidth={active ? "2.2" : "1.7"} />
      <path
        d="M6.75 18.25c.9-2.6 2.8-3.75 5.25-3.75s4.35 1.15 5.25 3.75"
        stroke="currentColor"
        strokeWidth={active ? "2.2" : "1.7"}
        strokeLinecap="round"
      />
    </svg>
  );
}
