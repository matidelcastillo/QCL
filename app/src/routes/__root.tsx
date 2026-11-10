import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { BRAND_NAME } from "@/lib/site";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <meta name="robots" content="noindex" />
      <div className="max-w-md text-center">
        <h1 className="text-hero font-medium text-foreground">404</h1>
        <h2 className="mt-simple text-title font-medium text-foreground">Esto no existe</h2>
        <p className="mt-simple text-body text-muted-foreground">
          El link está roto o la página se movió.
        </p>
        <div className="mt-doble">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-half text-body font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

const CHUNK_ERROR_RETRY_KEY = "qcl_chunk_error_reload";

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /dynamically imported module|Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(
    message,
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    if (isChunkLoadError(error) && !sessionStorage.getItem(CHUNK_ERROR_RETRY_KEY)) {
      sessionStorage.setItem(CHUNK_ERROR_RETRY_KEY, "1");
      window.location.reload();
    }
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-title font-medium text-foreground">Se rompió algo</h1>
        <p className="mt-simple text-body text-muted-foreground">
          Nuestro error, no tuyo. Probá de nuevo o volvé al inicio.
        </p>
        <div className="mt-doble flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-half text-body font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reintentar
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-half text-body font-medium text-foreground transition-colors hover:bg-accent"
          >
            Volver al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#F5F0EB" },
      { name: "format-detection", content: "telephone=no" },
      { title: BRAND_NAME },
      {
        name: "description",
        content: "Qué Carajo Leer. La base visual está. La biblioteca, todavía no.",
      },
      { name: "robots", content: "noindex" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
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

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    sessionStorage.removeItem(CHUNK_ERROR_RETRY_KEY);
  }, [pathname]);

  useEffect(() => {
    document.addEventListener("touchstart", () => {}, { passive: true });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div
        style={{
          maxWidth: "var(--app-viewport-max)",
          margin: "0 auto",
          minHeight: "100dvh",
          position: "relative",
        }}
      >
        <div className="safe-area-top qcba-content-fade">
          <Outlet />
        </div>
      </div>
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
