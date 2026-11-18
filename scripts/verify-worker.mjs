#!/usr/bin/env bun
/* Post-deploy check for the one live host. Fail the deploy command if `/`
   or a main asset redirects, if the CSP is loose, or if the app shell
   cannot boot. GitHub Actions is blocked, so this is the local gate. */
const ORIGIN = "https://qcl.matidelcastillo.workers.dev";
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

function fail(message) {
  console.error(`verify-worker: ${message}`);
  process.exit(1);
}

function header(res, name) {
  return res.headers.get(name) ?? "";
}

async function request(path, { method = "GET" } = {}) {
  const url = path.startsWith("http") ? path : `${ORIGIN}${path}`;
  const res = await fetch(url, {
    method,
    redirect: "manual",
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
  });
  return { url, res, status: res.status, location: header(res, "location") };
}

function assertNoRedirect(check, label) {
  if (check.status >= 300 && check.status < 400) {
    fail(`${label} returned ${check.status} to ${check.location || "(no location)"}`);
  }
  if (check.location) fail(`${label} sent Location: ${check.location}`);
  if (check.status !== 200) fail(`${label} returned ${check.status}`);
}

function assertCsp(csp) {
  if (!csp) fail("missing Content-Security-Policy");
  for (const part of ["default-src 'self'", "script-src 'self'", "connect-src 'self' https://mdytuysdombxyydqnsmj.supabase.co"]) {
    if (!csp.includes(part)) fail(`CSP is missing ${part}`);
  }
  if (csp.includes("'unsafe-inline'")) fail("CSP allows 'unsafe-inline'");
  if (/(^|[\s;])'unsafe-eval'/.test(csp)) fail("CSP allows 'unsafe-eval'");
  if (csp.includes("capacitor:") || csp.includes("ionic:")) {
    fail("CSP lists a Capacitor scheme; the bridge is a WKUserScript and does not need it");
  }
}

const home = await request("/");
assertNoRedirect(home, "GET /");
const type = header(home.res, "content-type");
if (!type.includes("text/html")) fail(`GET / content-type is ${type || "missing"}`);
assertCsp(header(home.res, "content-security-policy"));
for (const name of ["cross-origin-opener-policy", "cross-origin-resource-policy"]) {
  const value = header(home.res, name);
  if (value !== "same-origin") fail(`${name} is ${value || "missing"}, expected same-origin`);
}

const html = await home.res.text();
const entry = html.match(/<script[^>]+type="module"[^>]+src="(\/assets\/[^"]+\.js)"/);
const fallback = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
const assets = [];
if (entry) assets.push(entry[1]);
for (const href of fallback) if (!assets.includes(href)) assets.push(href);
if (assets.length === 0) fail("GET / did not reference a hashed /assets/ file");

for (const path of assets) {
  const check = await request(path);
  assertNoRedirect(check, path);
}

for (const path of ["/entrar", "/vos", "/gilada", "/leo"]) {
  const check = await request(path);
  assertNoRedirect(check, `GET ${path}`);
}

const leo = await request("/api/leo", { method: "POST" });
if (leo.status !== 503) fail(`POST /api/leo returned ${leo.status}, expected 503 while Qué leo is off`);
if (leo.location) fail("POST /api/leo sent a redirect");

const tapa = await request("/api/tapa?u=https%3A%2F%2Fcovers.openlibrary.org%2Fb%2Fid%2F1047466-L.jpg%3Fdefault%3Dfalse&isbn=9788432221552");
if (tapa.status !== 200) fail(`GET /api/tapa returned ${tapa.status}`);
if (tapa.location) fail("GET /api/tapa sent a redirect");
const tapaCorp = header(tapa.res, "cross-origin-resource-policy");
if (tapaCorp !== "cross-origin") {
  fail(`GET /api/tapa CORP is ${tapaCorp || "missing"}, expected cross-origin (build 4 covers)`);
}
const homeCorp = header(home.res, "cross-origin-resource-policy");
if (homeCorp !== "same-origin") fail(`GET / CORP is ${homeCorp || "missing"}, expected same-origin`);

const boot = /qué carajo lee/i.test(html) || /id="app"|id="root"/.test(html) || Boolean(entry);
if (!boot) fail("GET / does not look like the app shell");

console.log(
  `verify-worker: ${ORIGIN}/ is 200, ${assets.length} assets are 200, CSP is sane, no redirects.`,
);
