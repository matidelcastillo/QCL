import { normalizeIsbn } from "../domain/isbn";
import {
  cleanGenre,
  firstAuthors,
  identity,
  plainText,
  positiveInt,
  year,
} from "../domain/metadata";
import type { CatalogBook } from "../domain/types";
import { allowedCoverUrl, fetchCover } from "./cover";

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
type GoogleItem = { id?: unknown; volumeInfo?: GoogleInfo };
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
};

async function getJson(url: string): Promise<{ ok: boolean; data: unknown }> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { accept: "application/json" },
    });
    if (!response.ok) return { ok: response.status === 429, data: null };
    return { ok: true, data: await response.json() };
  } catch {
    return { ok: false, data: null };
  }
}

function googleCover(info: GoogleInfo): string | null {
  const image = info?.imageLinks?.thumbnail ?? info?.imageLinks?.smallThumbnail;
  return typeof image === "string"
    ? image.replace(/^http:/, "https:").replace(/&edge=curl/g, "")
    : null;
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
        title: info.title.trim(),
        author: firstAuthors(info.authors),
        isbn,
        coverUrl: googleCover(info),
        page_count: positiveInt(info.pageCount),
        published_year: year(info.publishedDate),
        genre: cleanGenre(info.categories),
        synopsis: plainText(info.description),
        source: "google" as const,
        externalId: String(item.id ?? info.title),
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
        title: doc.title.trim(),
        author: firstAuthors(doc.author_name),
        isbn,
        coverUrl: openLibraryCover(doc, isbn),
        page_count: positiveInt(doc.number_of_pages_median),
        published_year: year(doc.first_publish_year),
        genre: cleanGenre(doc.subject),
        synopsis: null,
        source: "openlibrary" as const,
        externalId: String(doc.key ?? doc.title),
      },
    ];
  });
}

async function openLibrary(query: string, isbn: string | null): Promise<SourceResult> {
  const params = new URLSearchParams({
    limit: "20",
    fields:
      "key,title,author_name,first_publish_year,isbn,cover_i,cover_edition_key,number_of_pages_median,subject",
  });
  params.set(isbn ? "isbn" : "q", query);
  const search = await getJson(`https://openlibrary.org/search.json?${params}`);
  let books = openLibraryBooks(search.data);
  if (
    !isbn &&
    books.length &&
    search.data &&
    typeof search.data === "object" &&
    "docs" in search.data &&
    Array.isArray(search.data.docs)
  ) {
    const exact = books.find((book) => identity(book.title) === identity(query) && book.author);
    const doc = (search.data.docs as OpenDoc[]).find(
      (candidate) =>
        candidate.title === exact?.title && firstAuthors(candidate.author_name) === exact?.author,
    );
    if (exact && doc && Array.isArray(doc.isbn)) {
      const candidates = [
        ...new Set(
          doc.isbn
            .map((value: unknown) => normalizeIsbn(String(value)))
            .filter((value): value is string => Boolean(value)),
        ),
      ].slice(0, 20);
      const checked = await Promise.all(
        candidates.map(async (value) => {
          const url = allowedCoverUrl(
            `https://books.google.com/books/content?vid=ISBN${value}&printsec=frontcover&img=1&zoom=1`,
          );
          return url && (await fetchCover(url)) ? { isbn: value, coverUrl: url.toString() } : null;
        }),
      );
      const valid = checked.filter((item): item is { isbn: string; coverUrl: string } =>
        Boolean(item),
      );
      const editions = await Promise.all(
        valid.slice(0, 8).map(async (item) => {
          const result = await getJson(`https://openlibrary.org/isbn/${item.isbn}.json`);
          const data = result.data as { languages?: Array<{ key?: string }> } | null;
          return {
            item,
            spanish:
              data?.languages?.some((language) => language.key === "/languages/spa") ?? false,
          };
        }),
      );
      const usable = editions.find((edition) => edition.spanish)?.item ?? valid[0];
      if (usable)
        books = books.map((book) =>
          book === exact ? { ...book, isbn: usable.isbn, coverUrl: usable.coverUrl } : book,
        );
    }
  }
  if (isbn) {
    const edition = await getJson(`https://openlibrary.org/isbn/${isbn}.json`);
    const doc = edition.data as OpenDoc | null;
    if (doc && typeof doc.title === "string") {
      books = [
        {
          title: doc.title,
          author: books[0]?.author ?? "",
          isbn,
          coverUrl:
            Array.isArray(doc.covers) && doc.covers[0]
              ? `https://covers.openlibrary.org/b/id/${doc.covers[0]}-L.jpg?default=false`
              : (books[0]?.coverUrl ?? null),
          page_count: positiveInt(doc.number_of_pages),
          published_year: year(doc.publish_date),
          genre: cleanGenre(doc.subjects),
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

async function google(query: string, isbn: string | null): Promise<SourceResult> {
  const params = new URLSearchParams({
    q: isbn ? `isbn:${isbn}` : query,
    printType: "books",
    maxResults: "20",
  });
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
  return score;
}

export function mergeBooks(query: string, groups: CatalogBook[][]): CatalogBook[] {
  const byIsbn = new Map<string, number>();
  const byName = new Map<string, number>();
  const mergedBooks: CatalogBook[] = [];
  for (const book of groups.flat()) {
    const name = `${identity(book.title)}|${identity(book.author)}`;
    const index = (book.isbn ? byIsbn.get(book.isbn) : undefined) ?? byName.get(name);
    if (index !== undefined) {
      const previous = mergedBooks[index];
      const preferred = rank(book, query) > rank(previous, query) ? book : previous;
      const merged = {
        ...previous,
        ...preferred,
        coverUrl: preferred.coverUrl ?? previous.coverUrl ?? book.coverUrl,
        isbn: preferred.isbn ?? previous.isbn ?? book.isbn,
        genre: preferred.genre ?? previous.genre ?? book.genre,
        synopsis: preferred.synopsis ?? previous.synopsis ?? book.synopsis,
      };
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

export async function searchCatalog(
  query: string,
  rawIsbn?: string | null,
): Promise<CatalogBook[]> {
  const isbn = rawIsbn ? normalizeIsbn(rawIsbn) : null;
  const results = await Promise.all([openLibrary(query, isbn), google(query, isbn)]);
  if (results.every((result) => !result.ok)) throw new Error("catalog_unavailable");
  return mergeBooks(
    query,
    results.map((result) => result.books),
  );
}
