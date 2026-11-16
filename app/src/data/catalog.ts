import type { CatalogBook } from "../domain/types";
import { apiUrl } from "./api-base";

/* Client for the worker's /api/libros (same origin). */
export async function searchCatalog(
  params: { q: string } | { isbn: string },
): Promise<CatalogBook[]> {
  const response = await fetch(apiUrl(`/api/libros?${new URLSearchParams(params)}`));
  if (!response.ok) throw new Error("catalog_unavailable");
  const data = (await response.json()) as { results: CatalogBook[] };
  return data.results;
}
