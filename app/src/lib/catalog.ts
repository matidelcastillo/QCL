import { normalizeIsbn, queryLooksLikeIsbn } from "@/lib/isbn";
import type { CatalogBook } from "@/lib/types";

const USER_AGENT = "QCL/1.0 (Qué Carajo Leer; personal library app)";

function asHttps(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://")) return `https://${url.slice("http://".length)}`;
  return url;
}

function googleCover(
  links: { thumbnail?: string; smallThumbnail?: string } | undefined,
): string | null {
  const raw = asHttps(links?.thumbnail ?? links?.smallThumbnail);
  if (!raw) return null;
  return raw.replace(/zoom=\d/, "zoom=1").replace("&edge=curl", "");
}

function yearFromDate(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const match = String(value).match(/(1[5-9]\d{2}|20\d{2}|2100)/);
  return match ? match[1] : null;
}

function firstIsbn(
  identifiers: Array<{ type?: string; identifier?: string }> | string[] | undefined,
): string | null {
  if (!identifiers) return null;
  const values = identifiers.map((item) =>
    typeof item === "string" ? item : (item.identifier ?? ""),
  );
  for (const value of values) {
    const isbn = normalizeIsbn(value);
    if (isbn) return isbn;
  }
  return null;
}

export function parseGoogleBooks(data: unknown): CatalogBook[] {
  if (
    !data ||
    typeof data !== "object" ||
    !("items" in data) ||
    !Array.isArray((data as { items: unknown }).items)
  ) {
    return [];
  }
  const items = (data as { items: Array<{ id?: string; volumeInfo?: Record<string, unknown> }> })
    .items;
  const results: CatalogBook[] = [];
  for (const item of items) {
    const info = item.volumeInfo ?? {};
    const title = typeof info.title === "string" ? info.title.trim() : "";
    if (!title) continue;
    const authors = Array.isArray(info.authors)
      ? info.authors.filter((name): name is string => typeof name === "string")
      : [];
    results.push({
      title,
      author: authors.join(", "),
      year: yearFromDate(typeof info.publishedDate === "string" ? info.publishedDate : null),
      coverUrl: googleCover(
        info.imageLinks as { thumbnail?: string; smallThumbnail?: string } | undefined,
      ),
      isbn: firstIsbn(
        info.industryIdentifiers as Array<{ type?: string; identifier?: string }> | undefined,
      ),
      source: "google",
      externalId: item.id ? `google:${item.id}` : `google:${title}`,
      language: typeof info.language === "string" ? info.language : null,
    });
  }
  return results;
}

export function parseOpenLibrarySearch(data: unknown): CatalogBook[] {
  if (
    !data ||
    typeof data !== "object" ||
    !("docs" in data) ||
    !Array.isArray((data as { docs: unknown }).docs)
  ) {
    return [];
  }
  const docs = (data as { docs: Array<Record<string, unknown>> }).docs;
  const results: CatalogBook[] = [];
  for (const doc of docs) {
    const title = typeof doc.title === "string" ? doc.title.trim() : "";
    if (!title) continue;
    const authors = Array.isArray(doc.author_name)
      ? doc.author_name.filter((name): name is string => typeof name === "string")
      : [];
    const languages = Array.isArray(doc.language)
      ? doc.language.filter((name): name is string => typeof name === "string")
      : [];
    const isbn = firstIsbn(Array.isArray(doc.isbn) ? (doc.isbn as string[]) : undefined);
    const coverId = typeof doc.cover_i === "number" ? doc.cover_i : null;
    const coverEdition = typeof doc.cover_edition_key === "string" ? doc.cover_edition_key : null;
    const workKey = typeof doc.key === "string" ? doc.key : null;
    const coverUrl = coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false`
      : coverEdition
        ? `https://covers.openlibrary.org/b/olid/${coverEdition}-L.jpg?default=false`
        : isbn
          ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`
          : null;
    results.push({
      title,
      author: authors.join(", "),
      year: yearFromDate(doc.first_publish_year as number | string | undefined),
      coverUrl,
      isbn,
      source: "openlibrary",
      externalId: workKey ? `ol:${workKey}` : `ol:${title}`,
      language:
        languages.includes("spa") || languages.includes("es") ? "es" : (languages[0] ?? null),
    });
  }
  return results;
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return fold(value)
    .split(" ")
    .filter((token) => token.length > 1);
}

function isSpanish(language: string | null): boolean {
  if (!language) return false;
  const value = language.toLowerCase();
  return value === "es" || value === "spa" || value.startsWith("es-");
}

function scoreBook(book: CatalogBook, query: string): number {
  const queryTokens = tokens(query);
  const haystack = fold(`${book.title} ${book.author}`);
  let score = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) score += 3;
  }
  const titleFold = fold(book.title);
  const queryFold = fold(query);
  if (
    titleFold === queryFold ||
    queryFold.startsWith(titleFold) ||
    titleFold.startsWith(queryFold)
  ) {
    score += 6;
  }
  if (book.coverUrl) score += 3;
  if (book.isbn) score += 2;
  if (isSpanish(book.language)) score += 4;
  if (book.year) score += 1;
  return score;
}

function dedupeKey(book: CatalogBook): string {
  if (book.isbn) return `isbn:${book.isbn}`;
  return `ta:${fold(book.title)}|${fold(book.author)}`;
}

export function mergeCatalog(query: string, groups: CatalogBook[][]): CatalogBook[] {
  const best = new Map<string, CatalogBook & { score: number }>();
  for (const group of groups) {
    for (const book of group) {
      const key = dedupeKey(book);
      const scored = { ...book, score: scoreBook(book, query) };
      const current = best.get(key);
      if (!current || scored.score > current.score) {
        if (current) {
          scored.coverUrl = scored.coverUrl ?? current.coverUrl;
          scored.isbn = scored.isbn ?? current.isbn;
          scored.year = scored.year ?? current.year;
        }
        best.set(key, scored);
      } else {
        current.coverUrl = current.coverUrl ?? scored.coverUrl;
        current.isbn = current.isbn ?? scored.isbn;
        current.year = current.year ?? scored.year;
      }
    }
  }
  return [...best.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(({ score: _score, ...book }) => book);
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function googleBooksUrl(query: string, lang?: string): string {
  const params = new URLSearchParams({
    q: query,
    printType: "books",
    maxResults: "20",
  });
  if (lang) params.set("langRestrict", lang);
  return `https://www.googleapis.com/books/v1/volumes?${params}`;
}

export function openLibrarySearchUrl(query: string, isbn?: string): string {
  const params = new URLSearchParams({
    limit: "20",
    fields:
      "key,title,author_name,first_publish_year,isbn,cover_i,language,cover_edition_key,edition_count",
  });
  if (isbn) params.set("isbn", isbn);
  else params.set("q", query);
  return `https://openlibrary.org/search.json?${params}`;
}

function withPreferredIsbn(book: CatalogBook, isbn: string): CatalogBook {
  return {
    ...book,
    isbn,
    coverUrl: book.coverUrl ?? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
  };
}

async function fetchOpenLibraryEdition(isbn: string): Promise<CatalogBook | null> {
  const data = await fetchJson(`https://openlibrary.org/isbn/${isbn}.json`, 8000);
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (!title) return null;
  const covers = Array.isArray(record.covers)
    ? record.covers.filter((id): id is number => typeof id === "number")
    : [];
  const key = typeof record.key === "string" ? record.key : isbn;
  const languages = Array.isArray(record.languages)
    ? record.languages
        .map((item) =>
          item && typeof item === "object" && "key" in item
            ? String((item as { key: unknown }).key)
            : "",
        )
        .map((item) => item.replace("/languages/", ""))
    : [];
  return {
    title,
    author: "",
    year: yearFromDate(typeof record.publish_date === "string" ? record.publish_date : null),
    coverUrl: covers[0]
      ? `https://covers.openlibrary.org/b/id/${covers[0]}-L.jpg?default=false`
      : `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
    isbn,
    source: "openlibrary",
    externalId: `ol:${key}`,
    language: languages.includes("spa") || languages.includes("es") ? "es" : (languages[0] ?? null),
  };
}

export async function searchOpenLibrary(query: string): Promise<CatalogBook[]> {
  const isbn = queryLooksLikeIsbn(query) ? normalizeIsbn(query) : null;
  const data = await fetchJson(openLibrarySearchUrl(query, isbn ?? undefined), 8000);
  const books = parseOpenLibrarySearch(data);
  if (!isbn) return books;
  const edition = await fetchOpenLibraryEdition(isbn);
  const stamped = books.map((book) => withPreferredIsbn(book, isbn));
  if (!edition) return stamped;
  const authorFromWork = stamped.find((book) => book.author)?.author ?? "";
  return [
    withPreferredIsbn({ ...edition, author: edition.author || authorFromWork }, isbn),
    ...stamped,
  ];
}

export async function searchGoogleBooks(query: string): Promise<CatalogBook[]> {
  const isbn = queryLooksLikeIsbn(query) ? normalizeIsbn(query) : null;
  const googleQuery = isbn ? `isbn:${isbn}` : query;
  const [spanish, anyLang] = await Promise.all([
    isbn ? Promise.resolve(null) : fetchJson(googleBooksUrl(googleQuery, "es"), 6000),
    fetchJson(googleBooksUrl(googleQuery), 6000),
  ]);
  return mergeCatalog(query, [parseGoogleBooks(spanish), parseGoogleBooks(anyLang)]);
}

export async function searchCatalogSources(query: string): Promise<CatalogBook[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const [openLibrary, google] = await Promise.all([
    searchOpenLibrary(trimmed),
    searchGoogleBooks(trimmed),
  ]);
  return mergeCatalog(trimmed, [openLibrary, google]);
}
