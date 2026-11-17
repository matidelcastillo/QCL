import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Navigate,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import css from "../styles.css?url";
import { SessionProvider } from "../data/session";
import { useSession } from "../data/session-context";
import { AppNav } from "../components/nav";
import { SheetProvider } from "../components/sheet";
import { useSheetOpen } from "../components/sheet-visibility";
import { LoadingPage } from "../components/feedback";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "robots", content: "noindex" },
      { title: "qué carajo lees" },
      { name: "apple-mobile-web-app-title", content: "qué carajo lees" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "theme-color", content: "#f5f0eb" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "stylesheet", href: css },
    ],
  }),
  shellComponent: Shell,
  component: Root,
  notFoundComponent: () => <Navigate to="/" />,
});

function Shell({ children }: { children: ReactNode }) {
  return (
    <html lang="es-AR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Root() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <SheetProvider>
          <Gate />
        </SheetProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

function Gate() {
  const { loading, user } = useSession();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const sheetOpen = useSheetOpen();
  if (loading)
    return (
      <div className="app-frame safe-area-top">
        <LoadingPage />
      </div>
    );
  const publicPath =
    path === "/entrar" || path === "/privacidad" || path === "/soporte" || path === "/clave";
  if (!user && !publicPath) return <Navigate to="/entrar" />;
  if (user && path === "/entrar") return <Navigate to="/" />;
  const bottomSafe = !user || path === "/clave";
  return (
    <div className={`app-frame safe-area-top${bottomSafe ? " safe-area-bottom" : ""}`}>
      <Outlet />
      {user && path !== "/clave" && <AppNav hidden={sheetOpen} />}
    </div>
  );
}
