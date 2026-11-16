/* Fixed Spanish genre list. A book's genre is chosen from it by the genre
   classifier (server/genre-ai.ts); anything else is "Otros". */
export const GENRES = [
  "Novela",
  "Cuentos",
  "Poesía",
  "Teatro",
  "Terror",
  "Ciencia ficción",
  "Fantasía",
  "Policial",
  "Historieta",
  "Infantil",
  "Filosofía",
  "Política",
  "Historia",
  "Ciencia",
  "Negocios",
  "Arte y diseño",
  "Biografía",
] as const;
export const OTHER_GENRE = "Otros";

const known = new Set<string>(GENRES);

/* Classifier answer → stored genre: an exact label from the list, else Otros. */
export function parseGenre(answer: string): string {
  const label = answer.trim();
  return known.has(label) ? label : OTHER_GENRE;
}

/* Stored genre if it belongs to the list (Otros and legacy labels do not). */
export function knownGenre(genre: string | null): string | null {
  return genre && known.has(genre) ? genre : null;
}

/* Stored genre → its home group. */
export function genreGroup(genre: string | null): string {
  return knownGenre(genre) ?? OTHER_GENRE;
}

/* QC groups (barrios) sort alphabetically; the catch-all goes last. */
export function groupByGenre<T extends { genre: string | null }>(items: T[]): Array<[string, T[]]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = genreGroup(item.genre);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].sort(([a], [b]) =>
    a === OTHER_GENRE ? 1 : b === OTHER_GENRE ? -1 : a.localeCompare(b, "es"),
  );
}
