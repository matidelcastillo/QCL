import { describe, expect, test } from "bun:test";
import type { Book } from "../domain/types";
import { duplicate, manualBook } from "./library";

const book = (fields: Partial<Book>): Book => ({
  id: "1",
  owner_id: "o",
  title: "Ficciones",
  author: "Jorge Luis Borges",
  status: "quiero",
  read_at: null,
  cover_url: null,
  isbn: null,
  source: "manual",
  external_id: null,
  page_count: null,
  published_year: null,
  genre: null,
  synopsis: null,
  created_at: "",
  updated_at: "",
  ...fields,
});

describe("duplicate", () => {
  test("manual book without ISBN matches the catalog edition with ISBN", () => {
    const manual = book({});
    expect(
      duplicate([manual], {
        title: "FICCIONES",
        author: "Jorge Luis Borges",
        isbn: "9788806173678",
      }),
    ).toBe(manual);
  });
  test("saved ISBN book matches a candidate without ISBN by title + author", () => {
    const saved = book({ isbn: "9788806173678", source: "openlibrary" });
    expect(duplicate([saved], { title: "Ficciones", author: "Jorge Luis Borges" })).toBe(saved);
  });
  test("same ISBN matches even if titles differ", () => {
    const saved = book({ isbn: "9788806173678", title: "Ficciones: cuentos" });
    expect(
      duplicate([saved], { title: "Ficciones", author: "Borges", isbn: "9788806173678" }),
    ).toBe(saved);
  });
  test("different book does not match", () => {
    expect(duplicate([book({})], { title: "Rayuela", author: "Julio Cortázar" })).toBeUndefined();
  });
});

describe("manualBook", () => {
  test("builds a manual catalog entry with trimmed fields and no cover", () => {
    const book = manualBook({
      title: "  Ficciones  ",
      author: "  Borges  ",
      isbn: "9788806173678",
    });
    expect(book).toMatchObject({
      title: "Ficciones",
      author: "Borges",
      isbn: "9788806173678",
      source: "manual",
      externalId: null,
      coverUrl: null,
    });
  });
});
