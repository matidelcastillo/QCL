import { groupByGenre } from "./genre";

/* Shared, stable order for a personal library: newest first, id as the
   tiebreaker so two books saved in the same instant never swap places. */
export function compareLibraryBooks<T extends { id: string; created_at: string }>(
  a: T,
  b: T,
): number {
  const created = (b.created_at ?? "").localeCompare(a.created_at ?? "");
  if (created !== 0) return created;
  return (b.id ?? "").localeCompare(a.id ?? "");
}

export function sortLibraryBooks<T extends { id: string; created_at: string }>(books: T[]): T[] {
  return [...books].sort(compareLibraryBooks);
}

export function compareReadBooks<
  T extends { id?: string; read_at: string | null; created_at?: string },
>(a: T, b: T): number {
  const byDate = (b.read_at ?? b.created_at ?? "").localeCompare(a.read_at ?? a.created_at ?? "");
  if (byDate !== 0) return byDate;
  return (b.id ?? "").localeCompare(a.id ?? "");
}

/* Canonical Biblioteca sequence: genres A–Z, Otros last, and within each
   group the shared library sort. List and grid must both use this order. */
export function libraryViewGroups<
  T extends { id: string; created_at: string; genre: string | null },
>(books: T[]): Array<[string, T[]]> {
  return groupByGenre(sortLibraryBooks(books));
}

export function libraryViewBooks<
  T extends { id: string; created_at: string; genre: string | null },
>(books: T[]): T[] {
  return libraryViewGroups(books).flatMap(([, items]) => items);
}
