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

const EDITION_TAIL =
  /^(new|nueva|nuevo|revised|revisada|updated|second|third|first|2nd|3rd|1st|edition|edici[oó]n|vol\.?|volume|tomo)\b/i;

/* "Julio Cortazar, Rayuela" is the work plus its author, even when the
   catalog row credits a critic or a compiler. */
export function splitAuthorTitle(title: string): { author: string; title: string } | null {
  const cleaned = cleanText(title);
  const match = cleaned.match(
    /^([A-ZÁÉÍÓÚÜÑ][\p{L}'’.-]+(?:\s+[A-ZÁÉÍÓÚÜÑ][\p{L}'’.-]+){1,3}),\s+(.+)$/u,
  );
  if (!match || EDITION_TAIL.test(match[2])) return null;
  return { author: match[1], title: match[2] };
}

export function workIdentity(title: string, author?: string | null): string {
  return identity(workTitle(title, author)).replace(
    /^(the|a|an|el|la|los|las|lo|un|una|unos|unas)\s+/,
    "",
  );
}

export function workTitle(title: string, author?: string | null): string {
  let result = cleanText(title);
  result = result
    .replace(/\s*\(([^)]{1,20})\)\s*$/u, (all, inner: string) => (/\d/.test(inner) ? all : ""))
    .trim();
  const split = splitAuthorTitle(result);
  if (split) result = split.title;
  if (author?.trim()) {
    for (const variant of authorVariants(author)) {
      result = stripAuthorSegment(result, variant, "prefix") ?? result;
      result = stripAuthorSegment(result, variant, "suffix") ?? result;
    }
  }
  return result || cleanText(title);
}

export function workKey(book: { title: string; author: string }): string {
  const author = splitAuthorTitle(book.title)?.author || book.author;
  return `${workIdentity(book.title, book.author)}|${authorKey(author)}`;
}

function lastToken(value: string): string {
  const parts = value.split(" ").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + cost);
      previous = current;
    }
  }
  return row[b.length]!;
}

export function authorsMatch(a: string, b: string): boolean {
  const left = authorKey(a);
  const right = authorKey(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const lastLeft = lastToken(left);
  const lastRight = lastToken(right);
  if (lastLeft.length >= 6 && lastLeft === lastRight) return true;
  if (Math.min(left.length, right.length) >= 6 && levenshtein(left, right) <= 2) return true;
  return lastLeft.length >= 6 && lastRight.length >= 6 && levenshtein(lastLeft, lastRight) <= 2;
}

export function sameWork(
  a: { title: string; author: string; isbn?: string | null },
  b: { title: string; author: string; isbn?: string | null },
): boolean {
  if (a.isbn && b.isbn && a.isbn === b.isbn) return true;
  const titleA = workIdentity(a.title, a.author);
  const titleB = workIdentity(b.title, b.author);
  if (!titleA || !titleB) return false;
  const close =
    titleA === titleB ||
    (Math.min(titleA.length, titleB.length) >= 5 && levenshtein(titleA, titleB) <= 2);
  if (!close) return false;
  const authorA = splitAuthorTitle(a.title)?.author || a.author;
  const authorB = splitAuthorTitle(b.title)?.author || b.author;
  return authorsMatch(authorA, authorB);
}

const ENGLISH_SMALL = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "for",
  "nor",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
]);

const SPANISH_MARKERS = new Set([
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "lo",
  "al",
  "del",
  "de",
  "y",
  "e",
  "o",
  "u",
  "que",
  "en",
  "por",
  "con",
  "para",
  "es",
  "su",
  "sus",
]);

function lettersOf(word: string): string {
  return word.replace(/[^\p{L}]/gu, "");
}

function isLowerWord(word: string): boolean {
  const letters = lettersOf(word);
  if (letters.length < 2) return false;
  return letters === letters.toLocaleLowerCase("es") && letters !== letters.toLocaleUpperCase("es");
}

export function looksSpanishTitle(title: string): boolean {
  if (/[áéíóúñüÁÉÍÓÚÑÜ]/.test(title)) return true;
  const tokens = title
    .trim()
    .split(/\s+/)
    .map((word) => fold(lettersOf(word)))
    .filter(Boolean);
  return tokens.some((token) => SPANISH_MARKERS.has(token));
}

function hasLowerContentWords(title: string): boolean {
  const parts = title.trim().split(/\s+/).filter(Boolean);
  return parts.slice(1).some((word) => {
    const letters = lettersOf(word);
    if (letters.length < 2) return false;
    if (ENGLISH_SMALL.has(fold(letters))) return false;
    return isLowerWord(word);
  });
}

function titleCaseWord(word: string, first: boolean): string {
  return word
    .split("-")
    .map((part, index) => {
      const letters = lettersOf(part);
      if (!letters) return part;
      const key = fold(letters);
      if (!first && index === 0 && ENGLISH_SMALL.has(key)) return part.toLocaleLowerCase("en-US");
      const cap =
        letters.charAt(0).toLocaleUpperCase("en-US") + letters.slice(1).toLocaleLowerCase("en-US");
      const start = part.search(/\p{L}/u);
      if (start < 0) return part;
      return part.slice(0, start) + cap + part.slice(start + letters.length);
    })
    .join("-");
}

/* Fix English titles that arrived with mid-words in lowercase.
   Leave Spanish sentence case alone. */
export function displayTitle(title: string): string {
  const cleaned = cleanText(title);
  if (!cleaned || looksSpanishTitle(cleaned) || !hasLowerContentWords(cleaned)) return cleaned;
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => titleCaseWord(word, index === 0))
    .join(" ");
}
