// @lovable.dev/vite-tanstack-config already includes tanstackStart, viteReact,
// tailwindcss, tsConfigPaths, and nitro (Cloudflare target at build time).
// Do not add those plugins again.
// QC's config also registered a cron module, a Buenos Aires build stamp, and
// manual chunks for its backend clients. None of that belongs in this shell.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
});
