import { normalizeIsbn } from "../domain/isbn";
import { CatalogUnavailable, searchCatalog } from "./catalog";
import { allowedCoverUrl, readBody } from "./cover";
import { findCover } from "./cover-search";
import { type Ai, classifyGenre, genreInput } from "./genre-ai";
import { parseLeoAnswers } from "../domain/leo";
import { collectCatalog, buildCandidates, pickWithModel, type LeoPick } from "./leo-ai";
import type { Book, SharedBook } from "../domain/types";

/* Bump when the CatalogBook shape or cleaning rules change, so cached
   responses from an older worker are not served. */
const CATALOG_SCHEMA = "7";

type RateLimit = { limit: (options: { key: string }) => Promise<{ success: boolean }> };

/* Worker bindings. GOOGLE_BOOKS_API_KEY is a secret; without it Google Books
   is called keyless (shared quota). CATALOG_LIMIT, GENRE_LIMIT and TAPA_LIMIT
   and LEO_LIMIT are the Workers rate limiters and AI the Workers AI binding, all declared
   in wrangler.jsonc. */
export type Env = {
  GOOGLE_BOOKS_API_KEY?: string;
  CATALOG_LIMIT?: RateLimit;
  GENRE_LIMIT?: RateLimit;
  TAPA_LIMIT?: RateLimit;
  LEO_LIMIT?: RateLimit;
  AI?: Ai;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
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
  out.headers.set("Access-Control-Allow-Headers", "content-type, authorization");
  out.headers.set("Access-Control-Expose-Headers", "x-qcl-cover-url");
  out.headers.set("Vary", "Origin");
  return out;
}

const API_PATHS = new Set(["/api/libros", "/api/tapa", "/api/genero", "/api/leo"]);

const json = (body: unknown, status = 200, cache = "no-store") =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache },
  });

const clientKey = (request: Request) => request.headers.get("cf-connecting-ip") ?? "local";

/* Small JSON: title, author and a handful of subject strings. */
export const GENRE_MAX_BYTES = 8_192;

function contentLengthTooLarge(request: Request, maxBytes: number) {
  const raw = request.headers.get("content-length");
  if (raw === null) return false;
  const length = Number(raw);
  return Number.isFinite(length) && length > maxBytes;
}

/* Missing bindings fail closed with 503 so a misconfigured deploy cannot
   run the providers or the classifier without a limit. */
async function allow(
  limiter: RateLimit | undefined,
  request: Request,
  limitedMessage: string,
): Promise<Response | null> {
  if (!limiter) return json({ error: "Servicio no disponible." }, 503);
  const { success } = await limiter.limit({ key: clientKey(request) });
  if (!success) return json({ error: limitedMessage }, 429);
  return null;
}

function workerCache() {
  return typeof caches !== "undefined"
    ? (caches as unknown as { default?: Cache }).default
    : undefined;
}

/* POST /api/genero: classify one book being saved (called once per save). */
async function genreResponse(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);
  if (contentLengthTooLarge(request, GENRE_MAX_BYTES))
    return json({ error: "Pedido demasiado grande." }, 413);
  const limited = await allow(env.GENRE_LIMIT, request, "Muchos pedidos. Probá en un rato.");
  if (limited) return limited;
  const bytes = await readBody(request, GENRE_MAX_BYTES);
  if (!bytes) return json({ error: "Pedido demasiado grande." }, 413);
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    parsed = null;
  }
  const input = genreInput(parsed);
  if (!input) return json({ error: "Libro inválido." }, 400);
  if (!env.AI) return json({ error: "Clasificador no disponible." }, 503);
  try {
    return json({ genre: await classifyGenre(env.AI, input) });
  } catch {
    return json({ error: "Clasificador no disponible." }, 503);
  }
}


export const LEO_MAX_BYTES = 8_192;

type LeoUser = { token: string; url: string; key: string };

async function leoAuth(request: Request, env: Env): Promise<LeoUser | Response> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY)
    return json({ error: "No autenticado." }, token ? 503 : 401);
  const url = env.SUPABASE_URL.replace(/\/$/, "");
  const key = env.SUPABASE_PUBLISHABLE_KEY;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return json({ error: "No autenticado." }, 401);
  return { token, url, key };
}

async function leoJson<T>(user: LeoUser, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${user.url}${path}`, {
    ...init,
    headers: {
      apikey: user.key,
      authorization: `Bearer ${user.token}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("supabase");
  return (await response.json()) as T;
}

async function leoResponse(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);
  if (contentLengthTooLarge(request, LEO_MAX_BYTES))
    return json({ error: "Pedido demasiado grande." }, 413);
  const limited = await allow(env.LEO_LIMIT, request, "Muchos pedidos. Probá en un rato.");
  if (limited) return limited;
  const bytes = await readBody(request, LEO_MAX_BYTES);
  if (!bytes) return json({ error: "Pedido demasiado grande." }, 413);
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    parsed = null;
  }
  const answers = parseLeoAnswers(parsed);
  if (!answers) return json({ error: "Pedido inválido." }, 400);
  const auth = await leoAuth(request, env);
  if (auth instanceof Response) return auth;
  if (!env.AI) return json({ error: "Recomendador no disponible." }, 503);
  try {
    const [library, gilada, catalog] = await Promise.all([
      leoJson<Book[]>(auth, "/rest/v1/books?select=*&order=created_at.desc"),
      leoJson<Array<Record<string, unknown>>>(auth, "/rest/v1/rpc/most_read_books", {
        method: "POST",
        body: "{}",
      }).then((rows) =>
        rows.map(
          (row): SharedBook => ({
            title: String(row.title ?? ""),
            author: String(row.author ?? ""),
            coverUrl: typeof row.cover_url === "string" ? row.cover_url : null,
            isbn: typeof row.isbn === "string" ? row.isbn : null,
            source: row.source === "google" || row.source === "openlibrary" ? row.source : "manual",
            externalId: typeof row.external_id === "string" ? row.external_id : null,
            page_count: typeof row.page_count === "number" ? row.page_count : null,
            published_year: typeof row.published_year === "string" ? row.published_year : null,
            genre: typeof row.genre === "string" ? row.genre : null,
            synopsis: typeof row.synopsis === "string" ? row.synopsis : null,
            leiCount: Number(row.lei_count) || 0,
            quieroCount: Number(row.quiero_count) || 0,
          }),
        ),
      ),
      collectCatalog(answers, env.GOOGLE_BOOKS_API_KEY),
    ]);
    const candidates = buildCandidates(answers, catalog, library, gilada);
    const picks: LeoPick[] = await pickWithModel(env.AI, answers, candidates);
    return json({ results: picks });
  } catch (error) {
    return error instanceof CatalogUnavailable
      ? json({ error: "Catálogo no disponible." }, 503)
      : json({ error: "No se pudo recomendar." }, 502);
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
  if (url.pathname === "/api/genero") return respond(genreResponse(request, env));
  if (url.pathname === "/api/leo") return respond(leoResponse(request, env));
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
    const cache = workerCache();
    /* Key on the normalized search only: extra params cannot skip the cache. */
    const cacheUrl = new URL("/api/libros", url.origin);
    cacheUrl.searchParams.set(isbn ? "isbn" : "q", query);
    cacheUrl.searchParams.set("schema", CATALOG_SCHEMA);
    const key = new Request(cacheUrl.toString(), { method: "GET" });
    const hit = await cache?.match(key);
    if (hit) return respond(hit);
    /* Only cache misses reach the providers, so only they spend the limit. */
    const limited = await allow(env.CATALOG_LIMIT, request, "Muchas búsquedas. Probá en un rato.");
    if (limited) return respond(limited);
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
  const cache = workerCache();
  const cacheUrl = new URL("/api/tapa", url.origin);
  if (coverUrl) cacheUrl.searchParams.set("u", coverUrl.toString());
  if (isbn) cacheUrl.searchParams.set("isbn", isbn);
  if (title) cacheUrl.searchParams.set("t", title);
  if (author) cacheUrl.searchParams.set("a", author);
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const hit = await cache?.match(cacheKey);
  if (hit) return respond(hit);
  const limited = await allow(env.TAPA_LIMIT, request, "Muchos pedidos. Probá en un rato.");
  if (limited) return respond(limited);
  const image = await findCover({ url: coverUrl, isbn, title, author });
  /* A miss is cached for a day so a cover-less row does not re-run the chain. */
  const response = image
    ? new Response(image.bytes as BodyInit, {
        headers: {
          "content-type": image.type,
          "cache-control": "public, max-age=2592000",
          "x-content-type-options": "nosniff",
          "x-qcl-cover-url": image.sourceUrl,
        },
      })
    : json({ error: "Tapa no encontrada." }, 404, "public, max-age=86400");
  try {
    await cache?.put(cacheKey, response.clone());
  } catch {
    /* Cache is best effort. */
  }
  return respond(response);
}
