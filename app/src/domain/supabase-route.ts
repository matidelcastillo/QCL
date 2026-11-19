/* The browser talks to Supabase through the worker (same origin) for every
   call that carries the user's JWT. Privacy tools strip the Authorization
   header from third-party requests (AdGuard Stealth Mode "Block third-party
   Authorization header", on by default in some setups): PostgREST then sees
   anon and every user call is a 401, so Mis libros never loads. Same-origin
   requests keep the header. Sign-in, sign-up and token refresh stay direct:
   they authenticate with the body, not the JWT, and Supabase Auth rate
   limits them per client IP, which a proxy would collapse into the
   worker's. */
export const SUPABASE_ORIGIN = "https://mdytuysdombxyydqnsmj.supabase.co";
export const SUPABASE_PROXY_PREFIX = "/sb";

const JWT_AUTH_PATHS = new Set(["/auth/v1/user", "/auth/v1/logout"]);

/* Supabase path (e.g. /rest/v1/books) that goes through the worker. */
export function proxiesSupabasePath(path: string) {
  return path.startsWith("/rest/v1/") || JWT_AUTH_PATHS.has(path);
}

/* Rewrites a Supabase URL to the worker's /sb route, or returns null. */
export function firstPartySupabaseUrl(url: string): string | null {
  if (!url.startsWith(`${SUPABASE_ORIGIN}/`)) return null;
  const parsed = new URL(url);
  if (parsed.origin !== SUPABASE_ORIGIN || !proxiesSupabasePath(parsed.pathname)) return null;
  return `${SUPABASE_PROXY_PREFIX}${parsed.pathname}${parsed.search}`;
}
