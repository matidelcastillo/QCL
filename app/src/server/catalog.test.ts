import { expect, test } from "bun:test";
import { mergeBooks } from "./catalog";
import type { CatalogBook } from "../domain/types";

const base: CatalogBook = {
  title: "Ficciones",
  author: "Jorge Luis Borges",
  isbn: "9788806173678",
  coverUrl: null,
  page_count: null,
  published_year: null,
  genre: null,
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

test("catalog keeps the Open Library cover over Google's", () => {
  const openLibrary = { ...base, coverUrl: "https://covers.openlibrary.org/b/id/1-L.jpg" };
  const google: CatalogBook = {
    ...base,
    source: "google",
    externalId: "g-1",
    coverUrl: "https://books.google.com/cover",
  };
  expect(mergeBooks("Ficciones", [[openLibrary], [google]])[0].coverUrl).toBe(openLibrary.coverUrl);
});
