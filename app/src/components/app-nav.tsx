import type { CSSProperties, ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";

const items = [
  { to: "/", label: "Libros", icon: BookOpenIcon },
  { to: "/agregar", label: "Buscar", icon: BarcodeIcon },
  { to: "/vos", label: "Vos", icon: UserIcon },
] as const;

const navBtnStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 14px",
  textDecoration: "none",
} as const satisfies CSSProperties;

const iconStyle = { position: "relative" as const };

const ACTIVE = "#FFFFFF";
const INACTIVE = "rgba(255,255,255,0.55)";

export function AppNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="qcl-nav-wrap">
      <nav
        className="app-bottom-nav glass glass-orange glass-orange-treatment glass-orange-nav-material sheen-top glass-blur-in"
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
              className="qcba-nav-btn"
              style={navBtnStyle}
            >
              <span className="nav-ripple-clip">
                <div className={active ? "nav-icon-halo active" : "nav-icon-halo"} />
                <Icon active={active} />
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function LucideIcon({
  active,
  name,
  children,
}: {
  active: boolean;
  name: string;
  children: ReactNode;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? ACTIVE : INACTIVE}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucide lucide-${name}`}
      aria-hidden="true"
      style={iconStyle}
    >
      {children}
    </svg>
  );
}

function BookOpenIcon({ active }: { active: boolean }) {
  return (
    <LucideIcon active={active} name="book-open">
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </LucideIcon>
  );
}

function BarcodeIcon({ active }: { active: boolean }) {
  return (
    <LucideIcon active={active} name="barcode">
      <path d="M3 5v14" />
      <path d="M8 5v14" />
      <path d="M12 5v14" />
      <path d="M17 5v14" />
      <path d="M21 5v14" />
    </LucideIcon>
  );
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <LucideIcon active={active} name="user">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </LucideIcon>
  );
}
