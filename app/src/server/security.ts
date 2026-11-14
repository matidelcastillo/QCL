// Security headers for every worker response.
// Covers come through /api/tapa (same origin), so img-src only needs 'self'.
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
};

export function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval'`,
    "style-src 'self' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data:",
    `connect-src 'self' ${SUPABASE_ORIGIN}`,
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function httpsRedirect(request: Request) {
  const url = new URL(request.url);
  if (url.protocol !== "http:" || url.hostname === "localhost") return null;
  url.protocol = "https:";
  return Response.redirect(url.toString(), 301);
}

export function secure(response: Response) {
  const nonce = btoa(crypto.randomUUID());
  const isHtml = response.headers.get("content-type")?.includes("text/html") ?? false;
  const out =
    isHtml && HTMLRewriter
      ? new HTMLRewriter()
          .on("script:not([src])", { element: (el) => el.setAttribute("nonce", nonce) })
          .transform(response)
      : new Response(response.body, response);
  for (const [name, value] of Object.entries(STATIC_HEADERS)) out.headers.set(name, value);
  out.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
  return out;
}
