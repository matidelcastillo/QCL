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
