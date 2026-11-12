import { Link, useRouterState } from "@tanstack/react-router";
import { Barcode, BookOpen, User } from "lucide-react";

export function AppNav({ hidden }: { hidden: boolean }) {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const items = [
    { to: "/" as const, label: "Inicio", Icon: BookOpen },
    { to: "/agregar" as const, label: "Agregar", Icon: Barcode },
    { to: "/vos" as const, label: "Vos", Icon: User },
  ];
  return (
    <nav className={`nav-wrap${hidden ? " hidden" : ""}`} aria-label="Principal">
      <div className="app-bottom-nav glass glass-orange glass-orange-treatment glass-orange-nav-material sheen-top">
        {items.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className="qcba-nav-btn"
            aria-label={label}
            aria-current={path === to ? "page" : undefined}
          >
            <span className="nav-ripple-clip">
              <span className={`nav-icon-halo${path === to ? " active" : ""}`} />
              <Icon className="nav-icon" size={26} strokeWidth={2} />
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
