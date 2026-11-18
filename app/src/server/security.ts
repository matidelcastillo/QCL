// Security headers for every worker response.
// Covers come through /api/tapa as blobs, so img-src must allow blob: as well as 'self'.
// The barcode reader (zxing-wasm, .wasm from 'self') needs 'wasm-unsafe-eval'.
const SUPABASE_ORIGIN = "https://mdytuysdombxyydqnsmj.supabase.co";

type ElementHandler = {
  element(element: { setAttribute(name: string, value: string): void }): void;
};
type Rewriter = {
  on(selector: string, handler: ElementHandler): Rewriter;
  transform(response: Response): Response;
};
declare const HTMLRewriter: (new () => Rewriter) | undefined;

export const STATIC_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  /* HTML and JSON stay same-origin. /api/tapa is overridden in secure()
     because App Store 1.0 (build 4) paints covers with <img src> from
     capacitor://localhost, a no-cors load that same-origin CORP blocks. */
  "Cross-Origin-Resource-Policy": "same-origin",
};

/* The Capacitor bridge is a WKUserScript, injected out of band, so it
   does not need a capacitor: or ionic: scheme in script-src. Do not
   loosen this policy for the iOS shell. */
export function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval'`,
    "style-src 'self'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    `connect-src 'self' ${SUPABASE_ORIGIN}`,
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/* http→https only. Never a host or path change, and never 301: WKWebView
   can cache a permanent redirect and open Safari. Any redirect we still
   emit is temporary and must not be stored. */
export function httpsRedirect(request: Request) {
  const url = new URL(request.url);
  if (url.protocol !== "http:" || url.hostname === "localhost") return null;
  url.protocol = "https:";
  return new Response(null, {
    status: 302,
    headers: { Location: url.toString(), "Cache-Control": "no-store" },
  });
}

export function secure(response: Response, request?: Request) {
  const nonce = btoa(crypto.randomUUID());
  const isHtml = response.headers.get("content-type")?.includes("text/html") ?? false;
  const out =
    isHtml && HTMLRewriter
      ? new HTMLRewriter()
          .on("script:not([src])", { element: (el) => el.setAttribute("nonce", nonce) })
          .transform(response)
      : new Response(response.body, response);
  for (const [name, value] of Object.entries(STATIC_HEADERS)) out.headers.set(name, value);
  /* Build 4 (App Store 1.0) still uses <img src={apiUrl("/api/tapa?...")}>
     from capacitor://localhost. That is a no-cors request, so it needs
     CORP: cross-origin. Do not loosen CORP on HTML or other APIs. */
  if (request && new URL(request.url).pathname === "/api/tapa") {
    out.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  }
  out.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
  /* HTML always revalidates, so a phone never keeps a stale app shell
     (assets are content-hashed and stay cacheable). */
  if (isHtml) out.headers.set("Cache-Control", "no-cache");
  return out;
}
