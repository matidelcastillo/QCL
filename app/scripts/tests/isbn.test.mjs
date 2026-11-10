import { describe, expect, test } from "bun:test";
import {
  isbnFromBarcode,
  isbn10To13,
  normalizeIsbn,
  queryLooksLikeIsbn,
} from "../../src/lib/isbn.ts";
import { mergeCatalog, parseOpenLibrarySearch } from "../../src/lib/catalog.ts";

describe("isbn", () => {
  test("keeps a valid ISBN-13", () => {
    expect(normalizeIsbn("978-84-376-0494-7")).toBe("9788437604947");
  });

  test("converts a valid ISBN-10 to ISBN-13", () => {
    expect(normalizeIsbn("84-376-0494-X")).toBe("9788437604947");
    expect(isbn10To13("843760494X")).toBe("9788437604947");
  });

  test("rejects a bad checksum", () => {
    expect(normalizeIsbn("9788437604948")).toBeNull();
  });

  test("reads a book barcode and ignores a random EAN", () => {
    expect(isbnFromBarcode("9788437604947")).toBe("9788437604947");
    expect(queryLooksLikeIsbn("978-84-376-0494-7")).toBe(true);
    expect(isbnFromBarcode("7790001234567")).toBeNull();
  });
});

describe("catalog merge", () => {
  test("prefers a Spanish edition with a cover when the same ISBN appears twice", () => {
    const google = [
      {
        title: "Cien años de soledad",
        author: "Gabriel García Márquez",
        year: "1967",
        coverUrl: null,
        isbn: "9788437604947",
        source: "google",
        externalId: "google:1",
        language: "es",
      },
    ];
    const openlibrary = [
      {
        title: "Cien años de soledad",
        author: "Gabriel García Márquez",
        year: "1967",
        coverUrl: "https://covers.openlibrary.org/b/id/1-L.jpg",
        isbn: "9788437604947",
        source: "openlibrary",
        externalId: "ol:/works/OL274505W",
        language: "es",
      },
    ];
    const merged = mergeCatalog("Cien años de soledad", [google, openlibrary]);
    expect(merged).toHaveLength(1);
    expect(merged[0].coverUrl).toContain("covers.openlibrary.org");
    expect(merged[0].isbn).toBe("9788437604947");
  });

  test("parses Open Library search docs", () => {
    const books = parseOpenLibrarySearch({
      docs: [
        {
          title: "Rayuela",
          author_name: ["Julio Cortázar"],
          first_publish_year: 1963,
          isbn: ["9788466331906"],
          cover_i: 123,
          language: ["spa"],
          key: "/works/OL123W",
        },
      ],
    });
    expect(books[0]).toMatchObject({
      title: "Rayuela",
      author: "Julio Cortázar",
      year: "1963",
      isbn: "9788466331906",
      source: "openlibrary",
      language: "es",
    });
    expect(books[0].coverUrl).toContain("/b/id/123-L.jpg");
  });
});
