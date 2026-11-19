import { afterEach, expect, test } from "bun:test";
import { apiResponse, withCors } from "./api";
import { LEO_ENABLED } from "../domain/leo";

const base = "https://qcl.example";
const allow = { limit: async () => ({ success: true }) };

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

function png(width = 200, height = 300, bytes = 2500) {
  const image = new Uint8Array(bytes);
  image.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(image.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return image;
}

function mockProviders(openLibrary: number, google: number) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("https://openlibrary.org/"))
      return openLibrary === 200
        ? Response.json({
            docs: [
              {
                title: "Rayuela",
                author_name: ["Julio Cortázar"],
                key: "/works/OL1W",
                cover_i: 1,
              },
            ],
          })
        : new Response("", { status: openLibrary });
    if (url.startsWith("https://www.googleapis.com/"))
      return google === 200
        ? Response.json({
            items: [
              {
                id: "g1",
                volumeInfo: {
                  title: "Rayuela",
                  authors: ["Julio Cortázar"],
                  imageLinks: { thumbnail: "https://books.google.com/books/content?id=g1" },
                },
              },
            ],
          })
        : new Response("", { status: google });
    if (
      url.startsWith("https://covers.openlibrary.org/") ||
      url.startsWith("https://books.google.com/")
    ) {
      return new Response(png(), { headers: { "content-type": "image/png" } });
    }
    return new Response("", { status: 404 });
  }) as typeof fetch;
}

test("both providers failing is an uncached 503, not an empty result", async () => {
  for (const [ol, g] of [
    [429, 429],
    [503, 500],
  ]) {
    mockProviders(ol, g);
    const response = await apiResponse(new Request(`${base}/api/libros?q=rayuela`), {
      CATALOG_LIMIT: allow,
    });
    expect(response?.status).toBe(503);
    expect(response?.headers.get("cache-control")).toBe("no-store");
  }
  globalThis.fetch = (async () => {
    throw new TypeError("network");
  }) as unknown as typeof fetch;
  expect(
    (await apiResponse(new Request(`${base}/api/libros?q=rayuela`), { CATALOG_LIMIT: allow }))
      ?.status,
  ).toBe(503);
});

test("one provider answering still returns results", async () => {
  mockProviders(429, 200);
  const google = await apiResponse(new Request(`${base}/api/libros?q=rayuela`), {
    CATALOG_LIMIT: allow,
  });
  expect(google?.status).toBe(200);
  expect(((await google?.json()) as { results: unknown[] }).results.length).toBeGreaterThan(0);
  mockProviders(200, 503);
  const openLibrary = await apiResponse(new Request(`${base}/api/libros?q=rayuela`), {
    CATALOG_LIMIT: allow,
  });
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
    CATALOG_LIMIT: allow,
  });
  await apiResponse(new Request(`${base}/api/libros?q=mafalda`), { CATALOG_LIMIT: allow });
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
  await apiResponse(new Request(`${base}/api/libros?q=84-7189-314-2`), { CATALOG_LIMIT: allow });
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
  const post = (body: unknown, env: Record<string, unknown> = {}) =>
    apiResponse(
      new Request(`${base}/api/genero`, { method: "POST", body: JSON.stringify(body) }),
      env,
    );
  expect((await apiResponse(new Request(`${base}/api/genero`)))?.status).toBe(405);
  expect((await post({ author: "x" }, { GENRE_LIMIT: allow }))?.status).toBe(400);
  expect((await post({ title: "Rayuela" }, { GENRE_LIMIT: allow }))?.status).toBe(503);
  const ai = { run: async () => ({ response: "Novela" }) };
  const response = await post(
    { title: "Rayuela", author: "Julio Cortázar" },
    { AI: ai, GENRE_LIMIT: allow },
  );
  expect(await response?.json()).toEqual({ genre: "Novela" });
  const limited = { AI: ai, GENRE_LIMIT: { limit: async () => ({ success: false }) } };
  expect((await post({ title: "Rayuela" }, limited))?.status).toBe(429);
});

test("rate limiters fail closed when the binding is missing", async () => {
  let fetched = 0;
  globalThis.fetch = (async () => {
    fetched += 1;
    return new Response("", { status: 404 });
  }) as unknown as typeof fetch;
  expect((await apiResponse(new Request(`${base}/api/libros?q=rayuela`)))?.status).toBe(503);
  expect((await apiResponse(new Request(`${base}/api/tapa?t=Rayuela`)))?.status).toBe(503);
  const genre = await apiResponse(
    new Request(`${base}/api/genero`, {
      method: "POST",
      body: JSON.stringify({ title: "Rayuela" }),
    }),
  );
  expect(genre?.status).toBe(503);
  const leo = await apiResponse(
    new Request(`${base}/api/leo`, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: JSON.stringify({
        purpose: "escaparme",
        mood: "oscuro",
        topic: "policial",
        pace: "vuele",
      }),
    }),
  );
  expect(leo?.status).toBe(503);
  expect(fetched).toBe(0);
});

test("genre route rejects an oversized body before reading it", async () => {
  let limited = 0;
  const env = {
    GENRE_LIMIT: {
      limit: async () => {
        limited += 1;
        return { success: true };
      },
    },
    AI: { run: async () => ({ response: "Novela" }) },
  };
  const tooLong = new Request(`${base}/api/genero`, {
    method: "POST",
    headers: { "content-length": "8193" },
    body: "{}",
  });
  expect((await apiResponse(tooLong, env))?.status).toBe(413);
  expect(limited).toBe(0);
  const oversized = JSON.stringify({ title: "x".repeat(8193) });
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(oversized));
      controller.close();
    },
  });
  const actual = await apiResponse(
    new Request(`${base}/api/genero`, {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit),
    env,
  );
  expect(actual?.status).toBe(413);
  expect(limited).toBe(1);
});

test("wrangler.jsonc declares the bindings the worker uses", async () => {
  const raw = await Bun.file(new URL("../../wrangler.jsonc", import.meta.url)).text();
  const parsed = JSON.parse(
    raw
      .replace(/("(?:\\.|[^"\\])*")|\/\/.*$/gm, (chunk, str) => str ?? "")
      .replace(/,(\s*[}\]])/g, "$1"),
  );
  const names = new Set((parsed.ratelimits ?? []).map((entry: { name: string }) => entry.name));
  expect(names).toEqual(
    new Set(["CATALOG_LIMIT", "GENRE_LIMIT", "TAPA_LIMIT", "LEO_LIMIT", "DIAG_LIMIT"]),
  );
  expect(parsed.ai?.binding).toBe("AI");
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

test("leo is off: /api/leo is unavailable and does not spend the limiter", async () => {
  expect(LEO_ENABLED).toBe(false);
  let spent = 0;
  const env = {
    LEO_LIMIT: {
      limit: async () => {
        spent += 1;
        return { success: true };
      },
    },
    SUPABASE_URL: "https://mdytuysdombxyydqnsmj.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    AI: { run: async () => ({ response: { picks: [] } }) },
  };
  const response = await apiResponse(
    new Request(`${base}/api/leo`, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: JSON.stringify({
        purpose: "escaparme",
        mood: "oscuro",
        topic: "policial",
        pace: "vuele",
      }),
    }),
    env,
  );
  expect(response?.status).toBe(503);
  expect(await response?.json()).toEqual({ error: "Recomendador no disponible." });
  expect(spent).toBe(0);
  expect((await apiResponse(new Request(`${base}/api/leo`)))?.status).toBe(503);
});

test("leo route: POST only, needs a session, validates the body, fails closed", async () => {
  if (!LEO_ENABLED) return;
  const allow = { limit: async () => ({ success: true }) };
  const env = {
    LEO_LIMIT: allow,
    SUPABASE_URL: "https://mdytuysdombxyydqnsmj.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    AI: { run: async () => ({ response: { picks: [] } }) },
  };
  expect((await apiResponse(new Request(`${base}/api/leo`)))?.status).toBe(405);
  const valid = {
    purpose: "escaparme",
    mood: "oscuro",
    topic: "policial",
    pace: "vuele",
  };
  expect(
    (
      await apiResponse(
        new Request(`${base}/api/leo`, { method: "POST", body: JSON.stringify(valid) }),
        env,
      )
    )?.status,
  ).toBe(401);
  const bad = await apiResponse(
    new Request(`${base}/api/leo`, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: JSON.stringify({ purpose: "nope", mood: "oscuro", topic: "policial", pace: "vuele" }),
    }),
    env,
  );
  expect(bad?.status).toBe(400);
  const limited = await apiResponse(
    new Request(`${base}/api/leo`, {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: JSON.stringify({
        purpose: "escaparme",
        mood: "oscuro",
        topic: "policial",
        pace: "vuele",
      }),
    }),
    { ...env, LEO_LIMIT: { limit: async () => ({ success: false }) } },
  );
  expect(limited?.status).toBe(429);
  let spent = 0;
  const unauth = await apiResponse(
    new Request(`${base}/api/leo`, {
      method: "POST",
      body: JSON.stringify(valid),
    }),
    {
      ...env,
      LEO_LIMIT: {
        limit: async () => {
          spent += 1;
          return { success: true };
        },
      },
    },
  );
  expect(unauth?.status).toBe(401);
  expect(spent).toBe(0);
});

test("scanner diagnostics log the outcome shape only", async () => {
  const logged: string[] = [];
  const log = console.log;
  console.log = (line: string) => void logged.push(line);
  try {
    const post = (body: string, env = { DIAG_LIMIT: allow }) =>
      apiResponse(new Request(`${base}/api/diag`, { method: "POST", body }), env);
    const ok = await post(
      JSON.stringify({
        kind: "cancelled",
        format: null,
        length: 13,
        digits: true,
        errorCode: "OS-PLUG-BARC-0006",
        errorMessage: "Couldn’t scan 9780140280197",
        native: true,
        plugin: true,
        origin: "https://qcl.matidelcastillo.workers.dev",
        app: "1.0.1 (9)",
        isbn: "9780140280197",
        token: "secret",
      }),
    );
    expect(ok?.status).toBe(204);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('"kind":"cancelled"');
    expect(logged[0]).toContain('"app":"1.0.1 (9)"');
    expect(logged[0]).not.toContain("9780140280197");
    expect(logged[0]).not.toContain("secret");
    expect((await post(JSON.stringify({ kind: "nope" })))?.status).toBe(400);
    expect((await post("x".repeat(2_000)))?.status).toBe(413);
    expect(
      (
        await apiResponse(new Request(`${base}/api/diag`, { method: "POST", body: "{}" }), {
          DIAG_LIMIT: { limit: async () => ({ success: false }) },
        })
      )?.status,
    ).toBe(429);
    expect((await apiResponse(new Request(`${base}/api/diag`)))?.status).toBe(405);
    expect(logged).toHaveLength(1);
  } finally {
    console.log = log;
  }
});
