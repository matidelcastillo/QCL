import { mergeCatalog, searchGoogleBooks } from "@/lib/catalog";
import type { CatalogBook } from "@/lib/types";

export async function searchCatalog(query: string): Promise<CatalogBook[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const fromApi = (async () => {
    const response = await fetch(`/api/libros?q=${encodeURIComponent(trimmed)}`);
    if (!response.ok) return [] as CatalogBook[];
    const data = (await response.json()) as { results?: CatalogBook[] };
    return data.results ?? [];
  })();

  const fromGoogle = searchGoogleBooks(trimmed).catch(() => [] as CatalogBook[]);
  const [apiResults, googleResults] = await Promise.all([fromApi, fromGoogle]);
  return mergeCatalog(trimmed, [apiResults, googleResults]);
}
