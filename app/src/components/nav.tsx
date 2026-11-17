import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Plus, User, UsersRound } from "lucide-react";

const items = [
  { to: "/", label: "Inicio", Icon: BookOpen },
  { to: "/agregar", label: "Buscar", Icon: Plus },
  { to: "/gilada", label: "Gilada", Icon: UsersRound },
  { to: "/vos", label: "Vos", Icon: User },
] as const;

/* QC routes/index.tsx l. 3220-3315: bottom nav, same classes and structure. */
export function AppNav({ hidden }: { hidden: boolean }) {
  const path = useRouterState({ select: (state) => state.location.pathname });
  return (
    <nav className={`app-nav${hidden ? " is-hidden" : ""}`} aria-label="Principal">
      <div className="app-bottom-nav glass glass-orange glass-orange-treatment glass-orange-nav-material sheen-top glass-blur-in">
        {items.map(({ to, label, Icon }) => {
          const active = path === to;
          return (
            <Link
              key={to}
              to={to}
              className="qcba-nav-btn"
              aria-label={label}
              aria-current={active ? "page" : undefined}
            >
              <span className="nav-ripple-clip">
                <span className={`nav-icon-halo${active ? " active" : ""}`} />
                <Icon className="nav-icon" size={26} strokeWidth={2} aria-hidden="true" />
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
