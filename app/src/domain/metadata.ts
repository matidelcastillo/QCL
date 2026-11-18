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

export function isSpanish(language: string | null | undefined): boolean | null {
  if (!language) return null;
  const code = language.trim().toLowerCase();
  if (!code) return null;
  if (
    code === "es" ||
    code === "spa" ||
    code === "es-419" ||
    code.startsWith("es-") ||
    code === "español"
  )
    return true;
  return false;
}

/* "Cortázar, Julio" and "Julio Cortázar" must hash to the same work. */
export function authorKey(author: string): string {
  return identity(author).split(" ").filter(Boolean).sort().join(" ");
}

function authorVariants(author: string): string[] {
  const cleaned = cleanText(author);
  if (!cleaned) return [];
  const variants = [cleaned];
  const comma = cleaned
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (comma.length === 2 && !comma[0].includes(" ")) {
    variants.push(`${comma[1]} ${comma[0]}`);
    variants.push(comma[0]);
  } else {
    const words = cleaned.split(" ");
    if (words.length >= 2) {
      variants.push(words[words.length - 1]);
      variants.push(`${words[words.length - 1]}, ${words.slice(0, -1).join(" ")}`);
    }
  }
  const seen = new Set<string>();
  return variants
    .filter((variant) => {
      const key = identity(variant);
      if (!key || key.length < 3 || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => identity(b).length - identity(a).length);
}

function titleWords(title: string): string[] {
  return title
    .trim()
    .split(/[\s,.:;/+|\\/\-–—]+/u)
    .filter(Boolean);
}

const LINK_WORDS = new Set(["by", "de", "del", "por", "von", "van"]);

function hasPunctuationBoundary(title: string, side: "prefix" | "suffix"): boolean {
  const pattern =
    side === "prefix" ? /^[^,.:;/\-–—]+[,.:;/\-–—]\s+\S/ : /\S\s*[,.:;/\-–—]\s*[^,.:;/\-–—]+$/;
  return pattern.test(title.trim());
}

function stripAuthorSegment(
  title: string,
  variant: string,
  side: "prefix" | "suffix",
): string | null {
  const words = titleWords(title);
  const target = identity(variant);
  if (!target || words.length < 2) return null;
  const singleWord = !target.includes(" ");
  if (singleWord && !hasPunctuationBoundary(title, side)) return null;
  if (side === "prefix") {
    for (let count = 1; count < words.length; count++) {
      if (identity(words.slice(0, count).join(" ")) !== target) continue;
      const rest = words
        .slice(count)
        .filter((word, index) => !(index === 0 && LINK_WORDS.has(identity(word))));
      return rest.length ? rest.join(" ") : null;
    }
    return null;
  }
  for (let count = 1; count < words.length; count++) {
    const chunk = words.slice(words.length - count);
    const name = LINK_WORDS.has(identity(chunk[0] ?? "")) ? chunk.slice(1) : chunk;
    if (!name.length || identity(name.join(" ")) !== target) continue;
    const rest = words.slice(0, words.length - count);
    return rest.length ? rest.join(" ") : null;
  }
  return null;
}

/* Catalog titles often repeat the author ("Julio Cortazar, Rayuela").
   The card should show the work name only. */
export function workTitle(title: string, author?: string | null): string {
  let result = cleanText(title);
  result = result
    .replace(/\s*\(([^)]{1,20})\)\s*$/u, (all, inner: string) => (/\d/.test(inner) ? all : ""))
    .trim();
  if (!author?.trim()) return result;
  for (const variant of authorVariants(author)) {
    result = stripAuthorSegment(result, variant, "prefix") ?? result;
    result = stripAuthorSegment(result, variant, "suffix") ?? result;
  }
  return result || cleanText(title);
}

export function workKey(book: { title: string; author: string }): string {
  return `${identity(workTitle(book.title, book.author))}|${authorKey(book.author)}`;
}
