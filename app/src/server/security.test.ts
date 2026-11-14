import { describe, expect, test } from "bun:test";
import { contentSecurityPolicy, httpsRedirect, secure } from "./security";

describe("security", () => {
  test("redirects http to https", () => {
    const res = httpsRedirect(new Request("http://qcl.example/vos?x=1"));
    expect(res?.status).toBe(301);
    expect(res?.headers.get("location")).toBe("https://qcl.example/vos?x=1");
    expect(httpsRedirect(new Request("https://qcl.example/"))).toBeNull();
  });
  test("sets headers on every response", () => {
    const res = secure(new Response("{}", { headers: { "content-type": "application/json" } }));
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("strict-transport-security")).toContain("max-age=");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });
  test("csp allows only app origins", () => {
    const csp = contentSecurityPolicy("abc");
    expect(csp).toContain("connect-src 'self' https://mdytuysdombxyydqnsmj.supabase.co");
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'wasm-unsafe-eval'");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
  });
});
