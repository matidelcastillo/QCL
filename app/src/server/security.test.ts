import { describe, expect, test } from "bun:test";
import { contentSecurityPolicy, httpsRedirect, secure } from "./security";

describe("security", () => {
  test("redirects http to https without caching the redirect", () => {
    const res = httpsRedirect(new Request("http://qcl.example/vos?x=1"));
    expect(res?.status).toBe(302);
    expect(res?.headers.get("location")).toBe("https://qcl.example/vos?x=1");
    expect(res?.headers.get("cache-control")).toBe("no-store");
    expect(httpsRedirect(new Request("https://qcl.example/"))).toBeNull();
  });
  test("sets headers on every response", () => {
    const res = secure(new Response("{}", { headers: { "content-type": "application/json" } }));
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("strict-transport-security")).toContain("max-age=");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("cross-origin-opener-policy")).toBe("same-origin");
    expect(res.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });
  test("HTML revalidates, other responses keep their caching", () => {
    const html = secure(new Response("<p></p>", { headers: { "content-type": "text/html" } }));
    expect(html.headers.get("cache-control")).toBe("no-cache");
    const json = secure(
      new Response("{}", {
        headers: { "content-type": "application/json", "cache-control": "public, max-age=60" },
      }),
    );
    expect(json.headers.get("cache-control")).toBe("public, max-age=60");
  });
  test("the cover proxy is embeddable from the bundled iOS shell, and nothing else is", () => {
    const tapa = secure(
      new Response(new Uint8Array([0xff, 0xd8]), { headers: { "content-type": "image/jpeg" } }),
      new Request("https://qcl.example/api/tapa?u=https://covers.openlibrary.org/b/id/1.jpg"),
    );
    expect(tapa.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
    const html = secure(
      new Response("<p></p>", { headers: { "content-type": "text/html" } }),
      new Request("https://qcl.example/"),
    );
    expect(html.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    const catalog = secure(
      new Response("{}", { headers: { "content-type": "application/json" } }),
      new Request("https://qcl.example/api/libros?q=rayuela"),
    );
    expect(catalog.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    /* Without a request (unit callers), keep the strict default. */
    const loose = secure(new Response("{}", { headers: { "content-type": "application/json" } }));
    expect(loose.headers.get("cross-origin-resource-policy")).toBe("same-origin");
  });

  test("csp allows only app origins", () => {
    const csp = contentSecurityPolicy("abc");
    expect(csp).toContain("connect-src 'self' https://mdytuysdombxyydqnsmj.supabase.co");
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'wasm-unsafe-eval'");
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).not.toContain("fonts.googleapis.com");
    expect(csp).not.toContain("fonts.gstatic.com");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
  });
});
