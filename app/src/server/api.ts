import { normalizeIsbn } from "../domain/isbn";
import { CatalogUnavailable, searchCatalog } from "./catalog";
import { allowedCoverUrl } from "./cover";
import { findCover } from "./cover-search";
import { type Ai, classifyGenre, genreInput } from "./genre-ai";
import { accountAdmin, bearerToken, deleteCallerAccount } from "./account";

/* Bump when the CatalogBook shape or cleaning rules change, so cached
   responses from an older worker are not served. */
const CATALOG_SCHEMA = "7";

type RateLimit = { limit: (options: { key: string }) => Promise<{ success: boolean }> };

/* Worker bindings. GOOGLE_BOOKS_API_KEY is a secret; without it Google Books
   is called keyless (shared quota). CATALOG_LIMIT and GENRE_LIMIT are the
   Workers rate limiters and AI the Workers AI binding, all declared in
   wrangler.jsonc. */
export type Env = {
  GOOGLE_BOOKS_API_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  CATALOG_LIMIT?: RateLimit;
  GENRE_LIMIT?: RateLimit;
  AI?: Ai;
};

const CAPACITOR_ORIGIN = "capacitor://localhost";

export function isCapacitorOrigin(request: Request) {
  return request.headers.get("Origin") === CAPACITOR_ORIGIN;
}

export function withCors(request: Request, response: Response) {
  if (!isCapacitorOrigin(request)) return response;
  const out = new Response(response.body, response);
  out.headers.set("Access-Control-Allow-Origin", CAPACITOR_ORIGIN);
  out.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  out.headers.set("Access-Control-Allow-Headers", "authorization, content-type");
  out.headers.set("Access-Control-Expose-Headers", "x-qcl-cover-url");
  out.headers.set("Vary", "Origin");
  return out;
}

const API_PATHS = new Set(["/api/libros", "/api/tapa", "/api/genero", "/api/cuenta"]);

async function accountResponse(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);
  const token = bearerToken(request);
  if (!token) return json({ error: "No autorizado." }, 401);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: "No disponible." }, 503);
  try {
    const result = await deleteCallerAccount(accountAdmin(env.SUPABASE_SERVICE_ROLE_KEY), token);
    if ("ok" in result) return json({ ok: true });
    return json({ error: result.error }, result.status);
  } catch {
    return json({ error: "No se pudo eliminar la cuenta." }, 500);
  }
}

const json = (body: unknown, status = 200, cache = "no-store") =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache },
  });

const clientKey = (request: Request) => request.headers.get("cf-connecting-ip") ?? "local";

/* POST /api/genero: classify one book being saved (called once per save). */
async function genreResponse(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);
  const input = genreInput(await request.json().catch(() => null));
  if (!input) return json({ error: "Libro inválido." }, 400);
  const allowed = (await env.GENRE_LIMIT?.limit({ key: clientKey(request) }))?.success ?? true;
  if (!allowed) return json({ error: "Muchos pedidos. Probá en un rato." }, 429);
  if (!env.AI) return json({ error: "Clasificador no disponible." }, 503);
  try {
    return json({ genre: await classifyGenre(env.AI, input) });
  } catch {
    return json({ error: "Clasificador no disponible." }, 503);
  }
}

export async function apiResponse(request: Request, env: Env = {}): Promise<Response | null> {
  const url = new URL(request.url);
  if (!API_PATHS.has(url.pathname)) return null;
  if (request.method === "OPTIONS") {
    return withCors(
      request,
      new Response(null, { status: isCapacitorOrigin(request) ? 204 : 403 }),
    );
  }
  const respond = async (pending: Promise<Response> | Response) => withCors(request, await pending);
  if (url.pathname === "/api/cuenta") return respond(accountResponse(request, env));
  if (url.pathname === "/api/genero") return respond(genreResponse(request, env));
  if (url.pathname !== "/api/libros" && url.pathname !== "/api/tapa") return null;
  if (request.method !== "GET") return respond(json({ error: "Método no permitido." }, 405));
  if (url.pathname === "/api/libros") {
    const isbnInput = url.searchParams.get("isbn");
    if (isbnInput && !normalizeIsbn(isbnInput))
      return respond(json({ error: "ISBN inválido." }, 400));
    /* A typed ISBN in q gets the ISBN lookup too (Google needs isbn:). */
    const text = (url.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ").toLowerCase();
    const isbn = normalizeIsbn(isbnInput ?? text);
    const query = isbn ?? text;
    if (!query) return respond(json({ results: [] }, 200, "public, max-age=3600"));
    if (query.length > 200) return respond(json({ error: "Búsqueda muy larga." }, 400));
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
    if (hit) return respond(hit);
    /* Only cache misses reach the providers, so only they spend the limit. */
    const allowed = (await env.CATALOG_LIMIT?.limit({ key: clientKey(request) }))?.success ?? true;
    if (!allowed) return respond(json({ error: "Muchas búsquedas. Probá en un rato." }, 429));
    let results;
    try {
      results = await searchCatalog(query, isbn, env.GOOGLE_BOOKS_API_KEY);
    } catch (error) {
      /* Errors are never cached: the next search retries the providers. */
      return error instanceof CatalogUnavailable
        ? respond(json({ error: "Catálogo no disponible." }, 503))
        : respond(json({ error: "No se pudo buscar." }, 502));
    }
    const response = json({ results }, 200, "public, max-age=3600");
    try {
      await cache?.put(key, response.clone());
    } catch {
      /* Cache is best effort. */
    }
    return respond(response);
  }
  const raw = url.searchParams.get("u");
  const coverUrl = raw ? allowedCoverUrl(raw) : null;
  if (raw && !coverUrl) return respond(json({ error: "Tapa inválida." }, 400));
  const isbn = normalizeIsbn(url.searchParams.get("isbn") ?? "");
  const title = (url.searchParams.get("t") ?? "").trim().slice(0, 200);
  const author = (url.searchParams.get("a") ?? "").trim().slice(0, 200);
  if (!coverUrl && !isbn && !title) return respond(json({ error: "Tapa inválida." }, 400));
  const image = await findCover({ url: coverUrl, isbn, title, author });
  /* A miss is cached for a day so a cover-less row does not re-run the chain. */
  if (!image) return respond(json({ error: "Tapa no encontrada." }, 404, "public, max-age=86400"));
  return respond(
    new Response(image.bytes as BodyInit, {
      headers: {
        "content-type": image.type,
        "cache-control": "public, max-age=2592000",
        "x-content-type-options": "nosniff",
        "x-qcl-cover-url": image.sourceUrl,
      },
    }),
  );
}
