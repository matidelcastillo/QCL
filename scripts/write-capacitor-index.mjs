#!/usr/bin/env node
/* Copy the web build into capacitor-web/ and write a static index.html
   for the iOS shell. Does not touch the worker's .output/public. */
import { cp, mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const publicDir = join(root, "app/.output/public");
const outDir = join(root, "capacitor-web");

await mkdir(outDir, { recursive: true });
await cp(publicDir, outDir, { recursive: true });
const files = await readdir(join(outDir, "assets"));
const entry = files.find((name) => /^index-.*\.js$/.test(name));
const css = files.find((name) => /^styles-.*\.css$/.test(name));
if (!entry || !css) {
  throw new Error("No se encontraron los assets del build (index-*.js / styles-*.css).");
}

const csp = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: https://qcl.matidelcastillo.workers.dev",
  "connect-src 'self' https://qcl.matidelcastillo.workers.dev https://mdytuysdombxyydqnsmj.supabase.co",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const html = `<!DOCTYPE html>
<html lang="es-AR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <title>qué carajo lees</title>
    <meta name="theme-color" content="#f5f0eb" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" />
    <link rel="stylesheet" href="/assets/${css}" />
  </head>
  <body>
    <script>
      self.$R = self.$R || {};
      $R.tsr = [];
      self.$_TSR = {
        hydrated: false,
        streamEnded: false,
        initialized: false,
        buffer: [],
        h() {
          this.hydrated = true;
          this.c();
        },
        e() {
          this.streamEnded = true;
          this.c();
        },
        c() {
          if (this.hydrated && this.streamEnded) {
            delete self.$_TSR;
            delete self.$R.tsr;
          }
        },
        p(fn) {
          this.initialized ? fn() : this.buffer.push(fn);
        },
        router: {
          manifest: { routes: { __root__: { preloads: ["/assets/${entry}"], scripts: [{ attrs: { type: "module", async: true, src: "/assets/${entry}" } }] } } },
          matches: [{ i: "__root__#", u: 1, s: "success", ssr: false }],
        },
      };
      $_TSR.e();
    </script>
    <script type="module" src="/assets/${entry}"></script>
  </body>
</html>
`;
await writeFile(join(outDir, "index.html"), html);
console.log("wrote capacitor-web/index.html for", entry, "and", css);
