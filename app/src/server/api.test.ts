import { afterEach, expect, test } from "bun:test";
import { apiResponse, withCors } from "./api";

const base = "https://qcl.example";

test("catalog rejects invalid requests before calling upstreams", async () => {
  expect((await apiResponse(new Request(`${base}/api/libros`, { method: "POST" })))?.status).toBe(
    405,
  );
  const empty = await apiResponse(new Request(`${base}/api/libros?q=`));
  expect(empty?.status).toBe(200);
  expect(await empty?.json()).toEqual({ results: [] });
  expect((await apiResponse(new Request(`${base}/api/libros?q=${"x".repeat(201)}`)))?.status).toBe(
    400,
  );
  expect((await apiResponse(new Request(`${base}/api/libros?isbn=9780000000000`)))?.status).toBe(
    400,
  );
});

test("cover endpoint refuses hosts outside the allowlist", async () => {
  expect(
    (await apiResponse(new Request(`${base}/api/tapa?u=https%3A%2F%2Fevil.example%2Fcover.jpg`)))
      ?.status,
  ).toBe(400);
});

test("cover endpoint rate limit returns 429 before fetching", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response("", { status: 404 });
  }) as unknown as typeof fetch;
  const limited = await apiResponse(new Request(`${base}/api/tapa?t=Rayuela`), {
    TAPA_LIMIT: { limit: async () => ({ success: false }) },
  });
  expect(limited?.status).toBe(429);
  expect(calls).toBe(0);
});

test("a cached cover is served without spending the rate limit", async () => {
  const cached = new Response(new Uint8Array([1, 2, 3]), {
    headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=2592000" },
  });
  (globalThis as unknown as { caches: { default: Cache } }).caches = {
    default: {
      match: async () => cached.clone(),
      put: async () => undefined,
    } as unknown as Cache,
  };
  let limited = 0;
  let fetched = 0;
  globalThis.fetch = (async () => {
    fetched += 1;
    return new Response("", { status: 404 });
  }) as unknown as typeof fetch;
  const response = await apiResponse(new Request(`${base}/api/tapa?t=Rayuela`), {
    TAPA_LIMIT: {
      limit: async () => {
        limited += 1;
        return { success: false };
      },
    },
  });
  expect(response?.status).toBe(200);
  expect(new Uint8Array(await response!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  expect(limited).toBe(0);
  expect(fetched).toBe(0);
});

const realFetch = globalThis.fetch;
const realCaches = (globalThis as { caches?: unknown }).caches;
afterEach(() => {
  globalThis.fetch = realFetch;
  if (realCaches === undefined) delete (globalThis as { caches?: unknown }).caches;
  else (globalThis as { caches?: unknown }).caches = realCaches;
});

function mockProviders(openLibrary: number, google: number) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("https://openlibrary.org/"))
      return openLibrary === 200
        ? Response.json({
            docs: [{ title: "Rayuela", author_name: ["Julio Cortázar"], key: "/works/OL1W" }],
          })
        : new Response("", { status: openLibrary });
    if (url.startsWith("https://www.googleapis.com/"))
      return google === 200
        ? Response.json({
            items: [{ id: "g1", volumeInfo: { title: "Rayuela", authors: ["Julio Cortázar"] } }],
          })
        : new Response("", { status: google });
    return new Response("", { status: 404 });
  }) as typeof fetch;
}

test("both providers failing is an uncached 503, not an empty result", async () => {
  for (const [ol, g] of [
    [429, 429],
    [503, 500],
  ]) {
    mockProviders(ol, g);
    const response = await apiResponse(new Request(`${base}/api/libros?q=rayuela`));
    expect(response?.status).toBe(503);
    expect(response?.headers.get("cache-control")).toBe("no-store");
  }
  globalThis.fetch = (async () => {
    throw new TypeError("network");
  }) as unknown as typeof fetch;
  expect((await apiResponse(new Request(`${base}/api/libros?q=rayuela`)))?.status).toBe(503);
});

test("one provider answering still returns results", async () => {
  mockProviders(429, 200);
  const google = await apiResponse(new Request(`${base}/api/libros?q=rayuela`));
  expect(google?.status).toBe(200);
  expect(((await google?.json()) as { results: unknown[] }).results.length).toBeGreaterThan(0);
  mockProviders(200, 503);
  const openLibrary = await apiResponse(new Request(`${base}/api/libros?q=rayuela`));
  expect(openLibrary?.status).toBe(200);
  expect(((await openLibrary?.json()) as { results: unknown[] }).results.length).toBeGreaterThan(0);
});

test("Google Books gets the key only when the secret is set", async () => {
  const googleUrls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("https://www.googleapis.com/")) googleUrls.push(url);
    return new Response("", { status: 404 });
  }) as typeof fetch;
  await apiResponse(new Request(`${base}/api/libros?q=mafalda`), {
    GOOGLE_BOOKS_API_KEY: "test-key",
  });
  await apiResponse(new Request(`${base}/api/libros?q=mafalda`));
  expect(new URL(googleUrls[0]).searchParams.get("key")).toBe("test-key");
  expect(new URL(googleUrls[1]).searchParams.has("key")).toBe(false);
});

test("an ISBN typed in q uses the ISBN lookup with country", async () => {
  const googleUrls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("https://www.googleapis.com/")) googleUrls.push(url);
    return new Response("", { status: 404 });
  }) as typeof fetch;
  await apiResponse(new Request(`${base}/api/libros?q=84-7189-314-2`));
  const params = new URL(googleUrls[0]).searchParams;
  expect(params.get("q")).toBe("isbn:9788471893147");
  expect(params.get("country")).toBe("AR");
});

test("cache key ignores extra params and rate limit stops provider calls", async () => {
  let providerCalls = 0;
  globalThis.fetch = (async () => {
    providerCalls += 1;
    return new Response("", { status: 404 });
  }) as unknown as typeof fetch;
  const limited = await apiResponse(new Request(`${base}/api/libros?q=Rayuela&cb=123`), {
    CATALOG_LIMIT: { limit: async () => ({ success: false }) },
  });
  expect(limited?.status).toBe(429);
  expect(providerCalls).toBe(0);
});

test("genre route: POST only, needs a title, answers with a label from the list", async () => {
  const post = (body: unknown, env = {}) =>
    apiResponse(
      new Request(`${base}/api/genero`, { method: "POST", body: JSON.stringify(body) }),
      env,
    );
  expect((await apiResponse(new Request(`${base}/api/genero`)))?.status).toBe(405);
  expect((await post({ author: "x" }))?.status).toBe(400);
  expect((await post({ title: "Rayuela" }))?.status).toBe(503);
  const ai = { run: async () => ({ response: "Novela" }) };
  const response = await post({ title: "Rayuela", author: "Julio Cortázar" }, { AI: ai });
  expect(await response?.json()).toEqual({ genre: "Novela" });
  const limited = { AI: ai, GENRE_LIMIT: { limit: async () => ({ success: false }) } };
  expect((await post({ title: "Rayuela" }, limited))?.status).toBe(429);
});

test("CORS is only set for capacitor://localhost on API routes", async () => {
  const native = { Origin: "capacitor://localhost" };
  const preflight = await apiResponse(
    new Request(`${base}/api/libros?q=`, { method: "OPTIONS", headers: native }),
  );
  expect(preflight?.status).toBe(204);
  expect(preflight?.headers.get("access-control-allow-origin")).toBe("capacitor://localhost");
  expect(preflight?.headers.get("access-control-allow-headers")).toContain("content-type");
  expect(preflight?.headers.get("access-control-expose-headers")).toContain("x-qcl-cover-url");
  const other = await apiResponse(
    new Request(`${base}/api/libros?q=`, {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example" },
    }),
  );
  expect(other?.status).toBe(403);
  expect(other?.headers.get("access-control-allow-origin")).toBeNull();
  const sameOrigin = await apiResponse(new Request(`${base}/api/libros?q=`));
  expect(sameOrigin?.headers.get("access-control-allow-origin")).toBeNull();
  const wrapped = withCors(
    new Request(`${base}/api/tapa`, { headers: native }),
    new Response("", { headers: { "x-qcl-cover-url": "https://example.com/c.jpg" } }),
  );
  expect(wrapped.headers.get("access-control-expose-headers")).toContain("x-qcl-cover-url");
});
