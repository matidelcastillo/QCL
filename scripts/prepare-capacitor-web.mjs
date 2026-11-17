#!/usr/bin/env node
/* Copy the iOS static build (app/dist/client, from `QCL_TARGET=ios vite build`)
   into capacitor-web/ and add a CSP to its index.html.

   index.html is the SPA shell prerendered by TanStack Start, so it carries
   the router's own inline bootstrap scripts. The CSP allows exactly those
   scripts by hash instead of 'unsafe-inline'. */
import { createHash } from "node:crypto";
import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const buildDir = join(root, "app/dist/client");
const outDir = join(root, "capacitor-web");

await rm(outDir, { recursive: true, force: true });
await cp(buildDir, outDir, { recursive: true });
/* Worker-only headers file; meaningless inside the app bundle. */
await rm(join(outDir, "_headers"), { force: true });

const indexPath = join(outDir, "index.html");
let html = await readFile(indexPath, "utf8");
if (!/<script type="module"[^>]*src="\/assets\/index-[^"]+\.js"/.test(html)) {
  throw new Error(
    "capacitor-web/index.html no tiene el script de entrada del cliente.",
  );
}

const inlineScripts = [
  ...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g),
];
const hashes = inlineScripts.map(
  ([, body]) =>
    `'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`,
);

const csp = [
  "default-src 'self'",
  ["script-src 'self' 'wasm-unsafe-eval'", ...hashes].join(" "),
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self' data: blob: https://qcl.matidelcastillo.workers.dev",
  "connect-src 'self' https://qcl.matidelcastillo.workers.dev https://mdytuysdombxyydqnsmj.supabase.co",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

html = html.replace(
  "<head>",
  `<head><meta http-equiv="Content-Security-Policy" content="${csp}"/>`,
);
await writeFile(indexPath, html);
console.log(
  `capacitor-web listo (${inlineScripts.length} scripts inline con hash en la CSP).`,
);
