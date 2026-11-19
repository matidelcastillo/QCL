import { expect, test } from "bun:test";
import {
  googleBooks,
  mergeBooks,
  mergeCoverList,
  mergeCovers,
  mergeSameEditions,
  openLibraryBooks,
  pickIsbn,
  withCover,
} from "./catalog";
import type { CatalogBook } from "../domain/types";

const base: CatalogBook = {
  title: "Ficciones",
  author: "Jorge Luis Borges",
  isbn: "9788806173678",
  coverUrl: null,
  page_count: null,
  published_year: null,
  subjects: [],
  categories: [],
  synopsis: null,
  source: "openlibrary",
  externalId: "ol-1",
};

test("catalog merges duplicate ISBNs even when source titles differ", () => {
  const google: CatalogBook = {
    ...base,
    title: "Ficciones: cuentos",
    source: "google",
    externalId: "g-1",
    coverUrl: "https://books.google.com/cover",
  };
  const result = mergeBooks("Ficciones", [[base], [google]]);
  expect(result).toHaveLength(1);
  expect(result[0].coverUrl).toBe(google.coverUrl);
});

test("catalog keeps a confirmed Open Library cover over Google's", () => {
  const openLibrary = { ...base, coverUrl: "https://covers.openlibrary.org/b/id/1-L.jpg" };
  const google: CatalogBook = {
    ...base,
    source: "google",
    externalId: "g-1",
    coverUrl: "https://books.google.com/cover",
  };
  expect(mergeBooks("Ficciones", [[openLibrary], [google]])[0].coverUrl).toBe(openLibrary.coverUrl);
});

test("same ISBN in another script keeps the Latin-script record", () => {
  const arabic: CatalogBook = {
    ...base,
    title: "الأمير الصغير",
    author: "سانت أكزوبري",
    source: "google",
    externalId: "g-ar",
  };
  const latin: CatalogBook = {
    ...base,
    title: "El princiito",
    source: "google",
    externalId: "g-es",
  };
  const [book] = mergeBooks(base.isbn!, [[], [arabic, latin]]);
  expect(book.title).toBe("El princiito");
});

test("withCover drops books that have no cover URL", () => {
  const bare = { ...base, coverUrl: null, title: "Sin tapa" };
  const pictured = {
    ...base,
    coverUrl: "https://covers.openlibrary.org/b/id/1-L.jpg",
    title: "Con tapa",
  };
  expect(withCover([bare, pictured]).map((book) => book.title)).toEqual(["Con tapa"]);
  expect(withCover([bare])).toEqual([]);
});

test("an ISBN-only Open Library cover yields to the Google thumbnail", () => {
  const openLibrary = {
    ...base,
    coverUrl: "https://covers.openlibrary.org/b/isbn/9788806173678-L.jpg",
  };
  const google: CatalogBook = {
    ...base,
    source: "google",
    externalId: "g-1",
    coverUrl: "https://books.google.com/cover",
  };
  const [book] = mergeBooks("Ficciones", [[openLibrary], [google]]);
  expect(book.coverUrl).toBe(google.coverUrl);
  expect(book.coverFallback).toBeUndefined();
});

test("an Open Library edition-key cover stays ahead of Google, with Google as fallback", () => {
  const openLibrary = {
    ...base,
    coverUrl: "https://covers.openlibrary.org/b/olid/OL123M-L.jpg",
  };
  const google: CatalogBook = {
    ...base,
    source: "google",
    externalId: "g-1",
    coverUrl: "https://books.google.com/cover",
  };
  const [book] = mergeBooks("Ficciones", [[openLibrary], [google]]);
  expect(book.coverUrl).toBe(openLibrary.coverUrl);
  expect(book.coverFallback).toBe("https://books.google.com/cover");
});

test("mergeCovers prefers Google over an ISBN-only Open Library URL and keeps a fallback when the OL cover is confirmed", () => {
  const olId = "https://covers.openlibrary.org/b/id/1-L.jpg";
  const olIsbn = "https://covers.openlibrary.org/b/isbn/9788806173678-L.jpg";
  const google = "https://books.google.com/cover";
  expect(mergeCovers(olIsbn, google)).toEqual({ coverUrl: google });
  expect(mergeCovers(olId, google)).toEqual({ coverUrl: olId, coverFallback: google });
  expect(mergeCovers(olIsbn, null)).toEqual({ coverUrl: olIsbn });
  expect(mergeCovers(null, google)).toEqual({ coverUrl: google });
  expect(mergeCovers(null, null)).toEqual({ coverUrl: null });
});

test("mergeSameEditions keeps the other provider as a cover fallback", () => {
  const openLibrary = {
    ...base,
    coverUrl: "https://covers.openlibrary.org/b/id/1-L.jpg",
  };
  const google: CatalogBook = {
    ...base,
    source: "google",
    externalId: "g-1",
    coverUrl: "https://books.google.com/cover",
  };
  const [book] = mergeSameEditions([[openLibrary], [google]]);
  expect(book.coverUrl).toBe(openLibrary.coverUrl);
  expect(book.coverFallback).toBe("https://books.google.com/cover");
});

test("mergeCoverList folds several URLs the same way mergeCovers would", () => {
  const olId = "https://covers.openlibrary.org/b/id/1-L.jpg";
  const google = "https://books.google.com/cover";
  const extra = "https://imagessl.casadellibro.com/a/l/t5/1/9788806173678.jpg";
  expect(mergeCoverList([olId, google, extra])).toEqual({
    coverUrl: olId,
    coverFallback: google,
  });
  expect(mergeCoverList([null, google])).toEqual({ coverUrl: google });
});

/* Scanning 9780140280197 returned 9789029086622: the Open Library work
   lists every edition and the first one won. */
test("an ISBN lookup keeps the scanned edition", () => {
  const scanned = "9780140280197";
  const other = "9789029086622";
  expect(pickIsbn([other, "0140280197"], scanned)).toBe(scanned);
  expect(pickIsbn([other, scanned])).toBe(other);

  const [work] = openLibraryBooks(
    {
      docs: [
        {
          key: "/works/OL1W",
          title: "The 48 Laws of Power",
          author_name: ["Robert Greene"],
          isbn: [other, scanned],
          cover_i: 6424160,
        },
      ],
    },
    scanned,
  );
  expect(work.isbn).toBe(scanned);

  const [volume] = googleBooks(
    {
      items: [
        {
          id: "g-48",
          volumeInfo: {
            title: "The 48 Laws of Power",
            authors: ["Robert Greene"],
            industryIdentifiers: [{ identifier: "0140280197" }, { identifier: scanned }],
          },
        },
      ],
    },
    scanned,
  );
  expect(volume.isbn).toBe(scanned);

  const edition: CatalogBook = {
    ...base,
    title: "The 48 Laws of Power",
    author: "Robert Greene",
    isbn: other,
    coverUrl: "https://covers.openlibrary.org/b/id/6424160-L.jpg",
    externalId: "/works/OL1W",
  };
  const exact: CatalogBook = {
    ...edition,
    isbn: scanned,
    coverUrl: null,
    source: "google",
    externalId: "g-48",
  };
  const merged = mergeBooks(scanned, [[edition], [exact]]);
  expect(merged[0].isbn).toBe(scanned);
  expect(mergeBooks(scanned, [[edition, { ...exact, title: "Otro" }], []])[0].isbn).toBe(scanned);
});
