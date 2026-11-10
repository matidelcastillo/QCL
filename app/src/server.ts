import "./lib/error-capture";

import { searchOpenLibrary, searchGoogleBooks, mergeCatalog } from "./lib/catalog";
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

async function maybeCatalogResponse(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/libros") return null;
  if (request.method !== "GET") {
    return json({ error: "Método no permitido." }, 405);
  }
  const query = (url.searchParams.get("q") ?? url.searchParams.get("isbn") ?? "").trim();
  if (!query) return json({ results: [] });
  if (query.length > 200) return json({ error: "La búsqueda es demasiado larga." }, 400);
  try {
    const [openLibrary, google] = await Promise.all([
      searchOpenLibrary(query),
      searchGoogleBooks(query),
    ]);
    return json({ results: mergeCatalog(query, [openLibrary, google]) });
  } catch (error) {
    console.error(error);
    return json({ error: "No se pudo buscar ahora." }, 502);
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
