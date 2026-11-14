import { afterEach, expect, test } from "bun:test";
import { apiResponse } from "./api";

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

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
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
