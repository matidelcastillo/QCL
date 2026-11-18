import { normalizeIsbn } from "../domain/isbn";
import {
  cleanText,
  firstAuthors,
  identity,
  plainText,
  positiveInt,
  year,
} from "../domain/metadata";
import type { CatalogBook } from "../domain/types";
import { allowedCoverUrl, fetchCover } from "./cover";
import { SUBJECT_LIMIT } from "./genre-ai";

type SourceResult = { ok: boolean; books: CatalogBook[] };
type GoogleInfo = {
  title?: unknown;
  authors?: unknown;
  imageLinks?: { thumbnail?: unknown; smallThumbnail?: unknown };
  industryIdentifiers?: Array<{ identifier?: unknown }>;
  pageCount?: unknown;
  publishedDate?: unknown;
  categories?: unknown;
  description?: unknown;
};
type GoogleItem = {
  id?: unknown;
  volumeInfo?: GoogleInfo & { language?: unknown };
  saleInfo?: { buyLink?: unknown };
};
type OpenDoc = {
  title?: unknown;
  isbn?: unknown;
  cover_i?: unknown;
  cover_edition_key?: unknown;
  author_name?: unknown;
  number_of_pages_median?: unknown;
  first_publish_year?: unknown;
  subject?: unknown;
  key?: unknown;
  covers?: unknown;
  number_of_pages?: unknown;
  publish_date?: unknown;
  subjects?: unknown;
  description?: unknown;
  language?: unknown;
};

async function getJson(url: string): Promise<{ ok: boolean; data: unknown }> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      /* Host and status only: the query string can carry the API key. */
      console.warn(`catalog ${new URL(url).host} ${response.status}`);
      return { ok: false, data: null };
    }
    return { ok: true, data: await response.json() };
  } catch (error) {
    console.warn(`catalog ${new URL(url).host} ${error instanceof Error ? error.name : "error"}`);
    return { ok: false, data: null };
  }
}

function googleCover(info: GoogleInfo): string | null {
  const image = info?.imageLinks?.thumbnail ?? info?.imageLinks?.smallThumbnail;
  return typeof image === "string"
    ? image.replace(/^http:/, "https:").replace(/&edge=curl/g, "")
    : null;
}

/* Subject labels as the classifier sees them: strings only, capped. */
function labels(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value): value is string => typeof value === "string")
    .map(cleanText)
    .filter(Boolean)
    .slice(0, SUBJECT_LIMIT);
}

function googleBooks(data: unknown): CatalogBook[] {
  if (!data || typeof data !== "object" || !("items" in data) || !Array.isArray(data.items))
    return [];
  return (data.items as GoogleItem[]).flatMap((item) => {
    const info = item?.volumeInfo;
    if (typeof info?.title !== "string" || !info.title.trim()) return [];
    const isbn = Array.isArray(info.industryIdentifiers)
      ? (info.industryIdentifiers
          .map((entry) => normalizeIsbn(String(entry?.identifier ?? "")))
          .find(Boolean) ?? null)
      : null;
    return [
      {
        title: cleanText(info.title),
        author: firstAuthors(info.authors),
        isbn,
        coverUrl: googleCover(info),
        page_count: positiveInt(info.pageCount),
        published_year: year(info.publishedDate),
        subjects: [],
        categories: labels(info.categories),
        synopsis: plainText(info.description),
        source: "google" as const,
        externalId: String(item.id ?? info.title),
        language: typeof info.language === "string" ? info.language : null,
        buyLink:
          typeof item.saleInfo?.buyLink === "string" && item.saleInfo.buyLink.startsWith("https:")
            ? item.saleInfo.buyLink
            : null,
      },
    ];
  });
}

function openLibraryCover(doc: OpenDoc, isbn: string | null): string | null {
  if (typeof doc.cover_i === "number" && Number.isInteger(doc.cover_i) && doc.cover_i > 0)
    return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg?default=false`;
  if (typeof doc.cover_edition_key === "string")
    return `https://covers.openlibrary.org/b/olid/${encodeURIComponent(doc.cover_edition_key)}-L.jpg?default=false`;
  return isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false` : null;
}

function openLibraryBooks(data: unknown): CatalogBook[] {
  if (!data || typeof data !== "object" || !("docs" in data) || !Array.isArray(data.docs))
    return [];
  return (data.docs as OpenDoc[]).flatMap((doc) => {
    if (typeof doc.title !== "string" || !doc.title.trim()) return [];
    const isbn = Array.isArray(doc.isbn)
      ? (doc.isbn.map((item: unknown) => normalizeIsbn(String(item))).find(Boolean) ?? null)
      : null;
    return [
      {
        title: cleanText(doc.title),
        author: firstAuthors(doc.author_name),
        isbn,
        coverUrl: openLibraryCover(doc, isbn),
        page_count: positiveInt(doc.number_of_pages_median),
        published_year: year(doc.first_publish_year, doc.publish_date),
        subjects: labels(doc.subject),
        categories: [],
        synopsis: null,
        source: "openlibrary" as const,
        externalId: String(doc.key ?? doc.title),
        language: Array.isArray(doc.language)
          ? String(doc.language.find((code: unknown) => typeof code === "string") ?? "") || null
          : null,
      },
    ];
  });
}

async function openLibrary(query: string, isbn: string | null): Promise<SourceResult> {
  const params = new URLSearchParams({
    limit: "20",
    fields:
      "key,title,author_name,first_publish_year,publish_date,isbn,cover_i,cover_edition_key,number_of_pages_median,subject,language",
  });
  params.set(isbn ? "isbn" : "q", query);
  const search = await getJson(`https://openlibrary.org/search.json?${params}`);
  let books = openLibraryBooks(search.data);
  if (isbn) {
    const edition = await getJson(`https://openlibrary.org/isbn/${isbn}.json`);
    const doc = edition.data as OpenDoc | null;
    if (doc && typeof doc.title === "string") {
      books = [
        {
          title: cleanText(doc.title),
          author: books[0]?.author ?? "",
          isbn,
          coverUrl:
            Array.isArray(doc.covers) && doc.covers[0]
              ? `https://covers.openlibrary.org/b/id/${doc.covers[0]}-L.jpg?default=false`
              : (books[0]?.coverUrl ?? null),
          page_count: positiveInt(doc.number_of_pages),
          published_year: year(doc.publish_date),
          /* Work subjects (search) are richer than the edition's own list. */
          subjects: books[0]?.subjects.length ? books[0].subjects : labels(doc.subjects),
          categories: [],
          synopsis: plainText(
            doc.description && typeof doc.description === "object" && "value" in doc.description
              ? doc.description.value
              : doc.description,
          ),
          source: "openlibrary",
          externalId: String(doc.key ?? isbn),
        },
        ...books,
      ];
    }
    return { ok: search.ok || edition.ok, books };
  }
  return { ok: search.ok, books };
}

async function google(
  query: string,
  isbn: string | null,
  key: string | undefined,
  langRestrict?: string,
): Promise<SourceResult> {
  const params = new URLSearchParams({
    q: isbn ? `isbn:${isbn}` : query,
    printType: "books",
    maxResults: "20",
    /* Workers egress has no usable geolocation and Books API refuses
       geo-restricted requests without a country. */
    country: "AR",
  });
  if (langRestrict) params.set("langRestrict", langRestrict);
  if (key) params.set("key", key);
  const result = await getJson(`https://www.googleapis.com/books/v1/volumes?${params}`);
  return { ok: result.ok, books: googleBooks(result.data) };
}

function rank(book: CatalogBook, query: string): number {
  const q = identity(query);
  const title = identity(book.title);
  const content = `${title} ${identity(book.author)}`;
  let score = title === q ? 20 : title.startsWith(q) ? 12 : 0;
  for (const word of q.split(" ")) if (word && content.includes(word)) score += 2;
  if (book.coverUrl) score += 2;
  if (book.isbn) score += 1;
  /* Same ISBN can come back in several scripts (Google lists an Arabic
     record for a Spanish edition); keep the one written in Latin script. */
  if (title) score += 1;
  return score;
}

/* A cover id or edition key is a real Open Library image. An ISBN URL is
   only a guess and often 404s, so Google's thumbnail wins in that case. */
export function trustedOpenLibraryCover(url: string | null | undefined): boolean {
  return Boolean(url && /covers\.openlibrary\.org\/b\/(?:id|olid)\//.test(url));
}

export function isbnOnlyOpenLibraryCover(url: string | null | undefined): boolean {
  return Boolean(url && /covers\.openlibrary\.org\/b\/isbn\//.test(url));
}

export type MergedCover = {
  coverUrl: string | null;
  coverFallback?: string;
};

export type CatalogBookWithFallback = CatalogBook & { coverFallback?: string };

export function mergeCovers(a: string | null, b: string | null): MergedCover {
  const urls = [a, b].filter((url): url is string => Boolean(url));
  const trusted = urls.find(trustedOpenLibraryCover) ?? null;
  const other =
    urls.find((url) => !trustedOpenLibraryCover(url) && !isbnOnlyOpenLibraryCover(url)) ?? null;
  const isbnOnly = urls.find(isbnOnlyOpenLibraryCover) ?? null;
  if (trusted)
    return other && other !== trusted
      ? { coverUrl: trusted, coverFallback: other }
      : { coverUrl: trusted };
  return { coverUrl: other ?? isbnOnly ?? null };
}

export function mergeBooks(query: string, groups: CatalogBook[][]): CatalogBookWithFallback[] {
  const byIsbn = new Map<string, number>();
  const byName = new Map<string, number>();
  const mergedBooks: CatalogBookWithFallback[] = [];
  for (const book of groups.flat()) {
    const name = `${identity(book.title)}|${identity(book.author)}`;
    const index = (book.isbn ? byIsbn.get(book.isbn) : undefined) ?? byName.get(name);
    if (index !== undefined) {
      const previous = mergedBooks[index];
      const preferred = rank(book, query) > rank(previous, query) ? book : previous;
      const covers = mergeCovers(previous.coverUrl, book.coverUrl);
      const merged = {
        ...previous,
        ...preferred,
        /* Spec 6.1: a confirmed Open Library cover (id or olid) first;
           if that URL is only an ISBN guess, or later fails verify, use Google. */
        coverUrl: covers.coverUrl,
        isbn: preferred.isbn ?? previous.isbn ?? book.isbn,
        /* Each provider brings its own labels; the classifier gets both. */
        subjects: previous.subjects.length ? previous.subjects : book.subjects,
        categories: previous.categories.length ? previous.categories : book.categories,
        synopsis: preferred.synopsis ?? previous.synopsis ?? book.synopsis,
        published_year: year(previous.published_year, book.published_year),
      };
      if (covers.coverFallback) merged.coverFallback = covers.coverFallback;
      else delete merged.coverFallback;
      mergedBooks[index] = merged;
      byName.set(name, index);
      byName.set(`${identity(previous.title)}|${identity(previous.author)}`, index);
      if (merged.isbn) byIsbn.set(merged.isbn, index);
    } else {
      const next = mergedBooks.push(book) - 1;
      byName.set(name, next);
      if (book.isbn) byIsbn.set(book.isbn, next);
    }
  }
  return mergedBooks.sort((a, b) => rank(b, query) - rank(a, query)).slice(0, 20);
}

/* Covers of the first results are checked before answering, so the list
   does not open on a broken or placeholder cover. Worst case stays well
   under the Workers free-plan cap of 50 subrequests: at most 3 provider
   calls plus 3 verified results, each with one cover fetch (up to 3 hops)
   and 2 edition covers (1 editions.json + 2×3 hops) ≈ 33, plus cache. */
const VERIFIED_RESULTS = 3;
const EDITION_COVER_TRIES = 2;

type Edition = {
  covers?: unknown;
  languages?: Array<{ key?: unknown }>;
  isbn_13?: unknown;
  isbn_10?: unknown;
};

async function coverPasses(raw: string | null): Promise<boolean> {
  const url = raw ? allowedCoverUrl(raw) : null;
  return Boolean(url && (await fetchCover(url)));
}

function editionIsbn(edition: Edition): string | null {
  const values = [edition.isbn_13, edition.isbn_10].flatMap((list) =>
    Array.isArray(list) ? list : [],
  );
  return values.map((value) => normalizeIsbn(String(value))).find(Boolean) ?? null;
}

/* Spec 6.1: Open Library by cover id, then by edition (Spanish first). */
async function editionCover(book: CatalogBook): Promise<CatalogBook | null> {
  if (book.source !== "openlibrary" || !/^\/works\/OL\d+W$/.test(book.externalId)) return null;
  const { data } = await getJson(
    `https://openlibrary.org${book.externalId}/editions.json?limit=50&fields=covers,languages,isbn_13,isbn_10`,
  );
  const entries = (data as { entries?: Edition[] } | null)?.entries ?? [];
  const spanish = (edition: Edition) =>
    edition.languages?.some((language) => language.key === "/languages/spa") ?? false;
  const candidates = entries
    .filter((edition) => Array.isArray(edition.covers) && Number(edition.covers[0]) > 0)
    .sort((a, b) => Number(spanish(b)) - Number(spanish(a)))
    .slice(0, EDITION_COVER_TRIES);
  for (const edition of candidates) {
    const coverUrl = `https://covers.openlibrary.org/b/id/${Number((edition.covers as unknown[])[0])}-L.jpg?default=false`;
    if (await coverPasses(coverUrl))
      return { ...book, coverUrl, isbn: editionIsbn(edition) ?? book.isbn };
  }
  return null;
}

function withoutFallback(book: CatalogBookWithFallback): CatalogBook {
  const { coverFallback: _fallback, ...rest } = book;
  return rest;
}

async function withVerifiedCover(book: CatalogBookWithFallback): Promise<CatalogBook> {
  if (await coverPasses(book.coverUrl)) return withoutFallback(book);
  const edition = await editionCover(book);
  if (edition) return withoutFallback(edition);
  if (book.coverFallback) return withoutFallback({ ...book, coverUrl: book.coverFallback });
  return withoutFallback({ ...book, coverUrl: null });
}

/* Throws CatalogUnavailable only when every provider failed (429, 5xx,
   network); one provider answering is enough to return results. */
export class CatalogUnavailable extends Error {
  constructor() {
    super("catalog_unavailable");
  }
}

export async function searchCatalog(
  query: string,
  rawIsbn?: string | null,
  googleKey?: string,
): Promise<CatalogBook[]> {
  const isbn = rawIsbn ? normalizeIsbn(rawIsbn) : null;
  const results = await Promise.all([openLibrary(query, isbn), google(query, isbn, googleKey)]);
  if (results.every((result) => !result.ok)) throw new CatalogUnavailable();
  const merged = mergeBooks(
    query,
    results.map((result) => result.books),
  );
  const verified = await Promise.all(merged.slice(0, VERIFIED_RESULTS).map(withVerifiedCover));
  return withCover([...verified, ...merged.slice(VERIFIED_RESULTS)]);
}

export function withCover(books: CatalogBookWithFallback[]): CatalogBook[] {
  return books.filter((book) => Boolean(book.coverUrl)).map(withoutFallback);
}

/* Recommendation search: same merge and cover-URL filter, no cover
   verification hops, so a few queries stay inside the subrequest cap. */
export async function searchCatalogQuick(
  query: string,
  googleKey?: string,
  langRestrict?: string,
): Promise<CatalogBook[]> {
  const results = await Promise.all([openLibrary(query, null), google(query, null, googleKey, langRestrict)]);
  if (results.every((result) => !result.ok)) throw new CatalogUnavailable();
  return withCover(mergeBooks(query, results.map((result) => result.books)));
}

