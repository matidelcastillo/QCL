import "./lib/error-capture";

import { searchOpenLibrary, searchGoogleBooks, mergeCatalog } from "./lib/catalog";
import {
  googleIsbnCoverUrls,
  isAllowedTapaUrl,
  isUsableCoverPayload,
  resolveTapaIsbn,
} from "./lib/tapa";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export function tagNotFoundResponse(response: Response): Response {
  if (response.status !== 404) return response;
  const headers = new Headers(response.headers);
  headers.set("x-robots-tag", "noindex");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const tapaResponse = await maybeTapaResponse(request);
      if (tapaResponse) return tapaResponse;
      const catalogResponse = await maybeCatalogResponse(request);
      if (catalogResponse) return catalogResponse;
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return tagNotFoundResponse(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};

const TAPA_FETCH_HEADERS = {
  accept: "image/*",
  "user-agent": "QCL/1.0 (Que Carajo Leer; personal library app)",
};

function tapaImageResponse(type: string, bytes: ArrayBuffer): Response {
  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": type,
      "cache-control": "public, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}

async function fetchTapaBytes(
  target: URL,
  timeoutMs: number,
  kind: "google" | "any" = "any",
): Promise<{ type: string; bytes: ArrayBuffer } | null> {
  let current = target;
  let upstream: Response | null = null;
  for (let hop = 0; hop < 4; hop += 1) {
    upstream = await fetch(current.toString(), {
      headers: TAPA_FETCH_HEADERS,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (![301, 302, 303, 307, 308].includes(upstream.status)) break;
    const location = upstream.headers.get("location");
    if (!location) return null;
    const next = isAllowedTapaUrl(new URL(location, current).toString());
    if (!next) return null;
    current = next;
  }
  if (!upstream || !upstream.ok) return null;
  const type = (upstream.headers.get("content-type") ?? "").split(";")[0].trim();
  const bytes = await upstream.arrayBuffer();
  if (!isUsableCoverPayload(type, bytes, kind)) return null;
  return { type, bytes };
}

async function maybeTapaResponse(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/tapa") return null;
  if (request.method !== "GET") {
    return new Response("Método no permitido.", { status: 405 });
  }
  const target = isAllowedTapaUrl(url.searchParams.get("u") ?? "");
  if (!target) return new Response("Tapa inválida.", { status: 400 });

  try {
    const isbn = resolveTapaIsbn(target, url.searchParams.get("isbn"));
    for (const candidate of isbn ? googleIsbnCoverUrls(isbn) : []) {
      const googleUrl = isAllowedTapaUrl(candidate);
      if (!googleUrl) continue;
      const google = await fetchTapaBytes(googleUrl, 4000, "google");
      if (google) return tapaImageResponse(google.type, google.bytes);
    }
    const primary = await fetchTapaBytes(target, 12000);
    if (primary) return tapaImageResponse(primary.type, primary.bytes);
    return new Response("No se pudo cargar.", { status: 502 });
  } catch (error) {
    console.error(error);
    return new Response("No se pudo cargar.", { status: 502 });
  }
}

async function maybeCatalogResponse(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/libros") return null;
  if (request.method !== "GET") {
    return json({ error: "Método no permitido." }, 405);
  }
  const query = (url.searchParams.get("q") ?? url.searchParams.get("isbn") ?? "").trim();
  if (!query) return json({ results: [] });
  if (query.length > 200) return json({ error: "Búsqueda muy larga." }, 400);
  try {
    const [openLibrary, google] = await Promise.all([
      searchOpenLibrary(query),
      searchGoogleBooks(query),
    ]);
    return json({ results: mergeCatalog(query, [openLibrary, google]) });
  } catch (error) {
    console.error(error);
    return json({ error: "No se pudo buscar." }, 502);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
