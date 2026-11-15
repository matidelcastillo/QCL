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
      { title: "que carajo lees" },
      { name: "apple-mobile-web-app-title", content: "que carajo lees" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
      },
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
  if (!user && path !== "/entrar") return <Navigate to="/entrar" />;
  if (user && path === "/entrar") return <Navigate to="/" />;
  return (
    <div className="app-frame safe-area-top">
      <Outlet />
      {user && <AppNav hidden={sheetOpen} />}
    </div>
  );
}
