import { isbn10 } from "../domain/isbn";
import { allowedCoverUrl, fetchCover } from "./cover";

export type CoverQuery = {
  url: URL | null;
  isbn: string | null;
  title: string;
  author: string;
};

/* Same edition first: every source that serves a cover by ISBN. Missing
   images come back as 404 or as placeholders that validCover rejects. */
export function isbnCoverUrls(isbn: string): string[] {
  const short = isbn10(isbn);
  return [
    `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
    `https://books.google.com/books/content?vid=ISBN${isbn}&printsec=frontcover&img=1&zoom=1`,
    `https://imagessl.casadellibro.com/a/l/t5/${isbn.slice(11)}/${isbn}.jpg`,
    ...(short ? [`https://m.media-amazon.com/images/P/${short}.01._SCLZZZZZZZ_.jpg`] : []),
  ];
}

const WORK_COVER_TRIES = 3;

/* Another edition of the same work: Open Library covers for the title and
   author, Spanish editions first. */
async function workCoverUrls(title: string, author: string): Promise<string[]> {
  if (!title) return [];
  const params = new URLSearchParams({ title, fields: "cover_i,language", limit: "10" });
  if (author) params.set("author", author);
  try {
    const response = await fetch(`https://openlibrary.org/search.json?${params}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    const { docs } = (await response.json()) as {
      docs?: Array<{ cover_i?: unknown; language?: unknown }>;
    };
    const spanish = (doc: { language?: unknown }) =>
      Array.isArray(doc.language) && doc.language.includes("spa");
    return (docs ?? [])
      .filter((doc) => Number(doc.cover_i) > 0)
      .sort((a, b) => Number(spanish(b)) - Number(spanish(a)))
      .slice(0, WORK_COVER_TRIES)
      .map(
        (doc) => `https://covers.openlibrary.org/b/id/${Number(doc.cover_i)}-L.jpg?default=false`,
      );
  } catch {
    return [];
  }
}

async function firstValid(urls: string[]) {
  for (const raw of urls) {
    const url = allowedCoverUrl(raw);
    const image = url && (await fetchCover(url));
    if (image) return image;
  }
  return null;
}

/* Stored cover, then same edition by ISBN, then another edition. */
export async function findCover(query: CoverQuery) {
  return (
    (query.url && (await fetchCover(query.url))) ||
    (query.isbn && (await firstValid(isbnCoverUrls(query.isbn)))) ||
    (await firstValid(await workCoverUrls(query.title, query.author)))
  );
}
