import { normalizeIsbn } from "../domain/isbn";
import { searchCatalog } from "./catalog";
import { allowedCoverUrl, fetchCover } from "./cover";

/* Bump when the CatalogBook shape or cleaning rules change, so cached
   responses from an older worker are not served. */
const CATALOG_SCHEMA = "3";

const json = (body: unknown, status = 200, cache = "no-store") =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache },
  });

export async function apiResponse(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/libros" && url.pathname !== "/api/tapa") return null;
  if (request.method !== "GET") return json({ error: "Método no permitido." }, 405);
  if (url.pathname === "/api/libros") {
    const isbnInput = url.searchParams.get("isbn");
    const isbn = isbnInput ? normalizeIsbn(isbnInput) : null;
    if (isbnInput && !isbn) return json({ error: "ISBN inválido." }, 400);
    const query = (isbn ?? url.searchParams.get("q") ?? "").trim();
    if (!query) return json({ results: [] }, 200, "public, max-age=3600");
    if (query.length > 200) return json({ error: "Búsqueda muy larga." }, 400);
    const cache =
      typeof caches !== "undefined"
        ? (caches as unknown as { default?: Cache }).default
        : undefined;
    const cacheUrl = new URL(url);
    cacheUrl.searchParams.set("schema", CATALOG_SCHEMA);
    const key = new Request(cacheUrl.toString(), { method: "GET" });
    const hit = await cache?.match(key);
    if (hit) return hit;
    try {
      const response = json(
        { results: await searchCatalog(query, isbn) },
        200,
        "public, max-age=3600",
      );
      try {
        await cache?.put(key, response.clone());
      } catch {
        /* Cache is best effort. */
      }
      return response;
    } catch {
      return json({ error: "No se pudo buscar." }, 502);
    }
  }
  const coverUrl = allowedCoverUrl(url.searchParams.get("u") ?? "");
  if (!coverUrl) return json({ error: "Tapa inválida." }, 400);
  let image = await fetchCover(coverUrl);
  if (!image) {
    const isbn = normalizeIsbn(url.searchParams.get("isbn") ?? "");
    const fallback =
      isbn &&
      allowedCoverUrl(
        `https://books.google.com/books/content?vid=ISBN${isbn}&printsec=frontcover&img=1&zoom=1`,
      );
    if (fallback) image = await fetchCover(fallback);
  }
  if (!image) return json({ error: "Tapa no encontrada." }, 404);
  return new Response(image.bytes as BodyInit, {
    headers: {
      "content-type": image.type,
      "cache-control": "public, max-age=2592000",
      "x-content-type-options": "nosniff",
      "x-qcl-cover-url": image.sourceUrl,
    },
  });
}
