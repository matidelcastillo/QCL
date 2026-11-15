import { normalizeIsbn } from "../domain/isbn";
import { CatalogUnavailable, searchCatalog } from "./catalog";
import { allowedCoverUrl } from "./cover";
import { findCover } from "./cover-search";

/* Bump when the CatalogBook shape or cleaning rules change, so cached
   responses from an older worker are not served. */
const CATALOG_SCHEMA = "6";

/* Worker bindings. GOOGLE_BOOKS_API_KEY is a secret; without it Google Books
   is called keyless (shared quota). CATALOG_LIMIT is the Workers rate limiter
   declared in wrangler.jsonc. */
export type Env = {
  GOOGLE_BOOKS_API_KEY?: string;
  CATALOG_LIMIT?: { limit: (options: { key: string }) => Promise<{ success: boolean }> };
};

const json = (body: unknown, status = 200, cache = "no-store") =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache },
  });

export async function apiResponse(request: Request, env: Env = {}): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/libros" && url.pathname !== "/api/tapa") return null;
  if (request.method !== "GET") return json({ error: "Método no permitido." }, 405);
  if (url.pathname === "/api/libros") {
    const isbnInput = url.searchParams.get("isbn");
    if (isbnInput && !normalizeIsbn(isbnInput)) return json({ error: "ISBN inválido." }, 400);
    /* A typed ISBN in q gets the ISBN lookup too (Google needs isbn:). */
    const text = (url.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ").toLowerCase();
    const isbn = normalizeIsbn(isbnInput ?? text);
    const query = isbn ?? text;
    if (!query) return json({ results: [] }, 200, "public, max-age=3600");
    if (query.length > 200) return json({ error: "Búsqueda muy larga." }, 400);
    const cache =
      typeof caches !== "undefined"
        ? (caches as unknown as { default?: Cache }).default
        : undefined;
    /* Key on the normalized search only: extra params cannot skip the cache. */
    const cacheUrl = new URL("/api/libros", url.origin);
    cacheUrl.searchParams.set(isbn ? "isbn" : "q", query);
    cacheUrl.searchParams.set("schema", CATALOG_SCHEMA);
    const key = new Request(cacheUrl.toString(), { method: "GET" });
    const hit = await cache?.match(key);
    if (hit) return hit;
    /* Only cache misses reach the providers, so only they spend the limit. */
    const client = request.headers.get("cf-connecting-ip") ?? "local";
    const allowed = (await env.CATALOG_LIMIT?.limit({ key: client }))?.success ?? true;
    if (!allowed) return json({ error: "Muchas búsquedas. Probá en un rato." }, 429);
    let results;
    try {
      results = await searchCatalog(query, isbn, env.GOOGLE_BOOKS_API_KEY);
    } catch (error) {
      /* Errors are never cached: the next search retries the providers. */
      return error instanceof CatalogUnavailable
        ? json({ error: "Catálogo no disponible." }, 503)
        : json({ error: "No se pudo buscar." }, 502);
    }
    const response = json({ results }, 200, "public, max-age=3600");
    try {
      await cache?.put(key, response.clone());
    } catch {
      /* Cache is best effort. */
    }
    return response;
  }
  const raw = url.searchParams.get("u");
  const coverUrl = raw ? allowedCoverUrl(raw) : null;
  if (raw && !coverUrl) return json({ error: "Tapa inválida." }, 400);
  const isbn = normalizeIsbn(url.searchParams.get("isbn") ?? "");
  const title = (url.searchParams.get("t") ?? "").trim().slice(0, 200);
  const author = (url.searchParams.get("a") ?? "").trim().slice(0, 200);
  if (!coverUrl && !isbn && !title) return json({ error: "Tapa inválida." }, 400);
  const image = await findCover({ url: coverUrl, isbn, title, author });
  /* A miss is cached for a day so a cover-less row does not re-run the chain. */
  if (!image) return json({ error: "Tapa no encontrada." }, 404, "public, max-age=86400");
  return new Response(image.bytes as BodyInit, {
    headers: {
      "content-type": image.type,
      "cache-control": "public, max-age=2592000",
      "x-content-type-options": "nosniff",
      "x-qcl-cover-url": image.sourceUrl,
    },
  });
}
