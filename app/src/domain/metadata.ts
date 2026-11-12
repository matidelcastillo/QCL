const translations: Record<string, string> = {
  fiction: "Ficción",
  "short stories": "Cuentos",
  novel: "Novela",
  poetry: "Poesía",
  essays: "Ensayo",
  "science fiction": "Ciencia ficción",
  fantasy: "Fantasía",
  mystery: "Misterio",
  biography: "Biografía",
  history: "Historia",
};

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function cleanGenre(values: unknown): string | null {
  if (!Array.isArray(values)) return null;
  for (const subject of values) {
    if (typeof subject !== "string") continue;
    const base = subject.split(/ -- | \/ /)[0].trim();
    const key = fold(base);
    if (
      !key ||
      key.length > 24 ||
      /\d|century|chronology|criticism|accessible book|protected daisy|in library|lending library|large type|staff picks|translation|language|buenos aires|argentina/.test(
        key,
      )
    )
      continue;
    if (["general", "literature", "fiction", "fiction, general"].includes(key)) continue;
    const translated = translations[key] ?? `${base[0].toUpperCase()}${base.slice(1)}`;
    if (translated.length <= 24) return translated;
  }
  return null;
}

export function plainText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:nbsp|amp|quot|#39);/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

export function firstAuthors(value: unknown): string {
  if (!Array.isArray(value)) return "";
  const authors = value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
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
