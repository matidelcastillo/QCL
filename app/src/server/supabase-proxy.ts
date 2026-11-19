import {
  proxiesSupabasePath,
  SUPABASE_ORIGIN,
  SUPABASE_PROXY_PREFIX,
} from "../domain/supabase-route";

/* Same-origin pass-through to Supabase for calls that carry the user's
   JWT. See domain/supabase-route.ts for why. It adds no privilege: the
   caller's own apikey and Authorization go upstream unchanged, so RLS
   decides exactly as for a direct call. */
const FORWARD_HEADERS = [
  "accept",
  "accept-profile",
  "apikey",
  "authorization",
  "content-profile",
  "content-type",
  "prefer",
  "range",
  "range-unit",
  "x-client-info",
  "x-retry-count",
];
const METHODS = new Set(["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE"]);

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export async function supabaseProxyResponse(
  request: Request,
  fetcher: Fetcher = (input, init) => fetch(input, init),
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(`${SUPABASE_PROXY_PREFIX}/`)) return null;
  const path = url.pathname.slice(SUPABASE_PROXY_PREFIX.length);
  const deny = (status: number) =>
    new Response(null, { status, headers: { "cache-control": "no-store" } });
  if (!proxiesSupabasePath(path)) return deny(404);
  if (!METHODS.has(request.method)) return deny(405);
  /* Only this app's pages: a cross-site page cannot use the worker. */
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== url.origin) return deny(403);
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") return deny(403);
  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const upstream = await fetcher(`${SUPABASE_ORIGIN}${path}${url.search}`, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "manual",
  });
  const out = new Response(upstream.body, upstream);
  out.headers.delete("set-cookie");
  out.headers.set("cache-control", "no-store");
  return out;
}
