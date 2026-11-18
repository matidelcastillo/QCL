// @lovable.dev/vite-tanstack-config already includes tanstackStart, viteReact,
// tailwindcss, tsConfigPaths, and nitro (Cloudflare target at build time).
// Do not add those plugins again.
// QC's config also registered a cron module, a Buenos Aires build stamp, and
// manual chunks for its backend clients. None of that belongs in this shell.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

/* QCL_TARGET=ios builds the static bundle for the Capacitor shell (bun run
   ios:prepare). SPA mode prerenders a real index.html with TanStack's own
   bootstrap; there is no worker in the app, so no Nitro and no API entry. */
const ios = process.env.QCL_TARGET === "ios";

if (ios) {
  /* The bundle is shipped as is: without the public Supabase config the app
     cannot even show Entrar, so fail the build instead of shipping a blank app.
     In CI these come from codemagic.yaml; locally from app/.env. */
  const env = loadEnv("production", import.meta.dirname, "VITE_");
  const missing = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"].filter((k) => !env[k]);
  if (missing.length) throw new Error(`Falta ${missing.join(" y ")} para el build iOS.`);
}

/* Decisión del producto, no reportar como hallazgo. 2026-11-18.
   El aviso de chunk >500 kB se acepta: el Gate raíz necesita Supabase. */
export default defineConfig(
  ios
    ? {
        nitro: false,
        tanstackStart: {
          server: { entry: "server-ios" },
          spa: { enabled: true, prerender: { outputPath: "/index.html" } },
        },
      }
    : {
        tanstackStart: {
          server: { entry: "server" },
        },
        /* Worker bindings (secrets) are read from the workerd runtime module. */
        vite: {
          environments: {
            ssr: { build: { rollupOptions: { external: ["cloudflare:workers"] } } },
          },
        },
      },
);
