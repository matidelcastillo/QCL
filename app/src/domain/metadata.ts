function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/* Spec 6.2. Catalog subjects are mostly noise (places, periods, criticism,
   library flags, languages), so only known genre names are kept and shown in
   Spanish. Specific genres win over the generic "Novela". */
const specificGenres: Array<[string, string[]]> = [
  ["Cuentos", ["short stories", "cuentos"]],
  ["Poesía", ["poetry", "poems", "poesia"]],
  ["Ensayo", ["essays", "ensayos", "ensayo"]],
  ["Ciencia ficción", ["science fiction", "ciencia ficcion"]],
  ["Fantasía", ["fantasy", "fantasy fiction", "fantasia"]],
  ["Misterio", ["mystery", "mystery fiction", "detective and mystery stories", "misterio"]],
  ["Biografía", ["biography", "autobiography", "biografia", "autobiografia"]],
  ["Historia", ["history", "historia"]],
  ["Realismo mágico", ["magic realism", "magic realism (literature)", "realismo magico"]],
  ["Terror", ["horror", "horror fiction", "terror"]],
  ["Teatro", ["drama", "teatro"]],
  ["Filosofía", ["philosophy", "filosofia"]],
];
const genericGenres: Array<[string, string[]]> = [
  ["Novela", ["novel", "novels", "novela", "novelas"]],
];

function subjectParts(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value): value is string => typeof value === "string")
    .flatMap((value) => value.split(/ -- | \/ /))
    .map(fold);
}

function firstMatch(parts: string[], genres: Array<[string, string[]]>): string | null {
  for (const part of parts)
    for (const [label, names] of genres) if (names.includes(part)) return label;
  return null;
}

export function cleanGenre(values: unknown): string | null {
  const parts = subjectParts(values);
  return firstMatch(parts, specificGenres) ?? firstMatch(parts, genericGenres);
}

export function plainText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return cleanText(value.replace(/<[^>]*>/g, " ").replace(/&(?:nbsp|amp|quot|#39);/g, " ")) || null;
}

/* Catalog text arrives in mixed Unicode forms (Open Library often sends
   decomposed accents); store and compare composed text only. */
export function cleanText(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

export function firstAuthors(value: unknown): string {
  if (!Array.isArray(value)) return "";
  const authors = value
    .filter((item): item is string => typeof item === "string")
    .map(cleanText)
    .filter(Boolean);
  return authors.length === 2 ? authors.join(", ") : (authors[0] ?? "");
}

export function year(value: unknown): string | null {
  const match = String(value ?? "").match(/\b\d{4}\b/);
  return match?.[0] ?? null;
}

export function positiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function identity(value: string): string {
  return fold(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
