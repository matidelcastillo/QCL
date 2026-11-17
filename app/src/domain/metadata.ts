export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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

/* Keep years that a printed book could have. If the sources list a tight
   cluster of edition dates and one much earlier year (a typo or a birth
   year, as with Open Library's 1960 next to Linchpin's 2010–2012 dates),
   drop the isolated early year. */
const YEAR_MIN = 1450;
const YEAR_CLUSTER_GAP = 25;
const YEAR_PAIR_GAP = 40;

export function year(...values: unknown[]): string | null {
  const years = [
    ...new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .flatMap((part) =>
          [...String(part ?? "").matchAll(/\b(\d{4})\b/g)].map((match) => Number(match[1])),
        ),
    ),
  ]
    .filter((item) => item >= YEAR_MIN && item <= new Date().getFullYear() + 1)
    .sort((a, b) => a - b);
  if (!years.length) return null;
  while (years.length >= 2) {
    const rest = years.slice(1);
    const gap = rest[0] - years[0];
    const restSpan = rest[rest.length - 1] - rest[0];
    if (rest.length >= 2 && gap >= YEAR_CLUSTER_GAP && restSpan < gap) years.shift();
    else if (rest.length === 1 && gap >= YEAR_PAIR_GAP) years.shift();
    else break;
  }
  return String(years[0]);
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
