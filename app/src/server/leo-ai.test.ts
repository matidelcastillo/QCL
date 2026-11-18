import { describe, expect, test } from "bun:test";
import type { Book, CatalogBook, SharedBook } from "../domain/types";
import type { LeoAnswers } from "../domain/leo";
import {
  buildCandidates,
  candidateId,
  fillPicks,
  pickWithModel,
  sanitizeLine,
  searchQueries,
  valueLine,
  type LeoCandidate,
} from "./leo-ai";

const answers: LeoAnswers = {
  purpose: "escaparme",
  mood: "oscuro",
  topic: "policial",
  pace: "vuele",
  anchor: { title: "Rayuela", author: "Julio Cortázar", page_count: 746 },
};

const catalog = (title: string, extra: Partial<CatalogBook> = {}): CatalogBook => ({
  title,
  author: "Autor",
  isbn: extra.isbn ?? "9780000000000",
  page_count: 200,
  published_year: "2010",
  synopsis: null,
  coverUrl: extra.coverUrl ?? "https://covers.openlibrary.org/b/id/1-L.jpg",
  source: "openlibrary",
  externalId: extra.externalId ?? `/works/${title.replace(/\s/g, "")}`,
  subjects: [],
  categories: [],
  ...extra,
});

const libraryBook = (title: string, status: Book["status"], extra: Partial<Book> = {}): Book => ({
  id: extra.id ?? title,
  owner_id: "me",
  title,
  author: "Autor",
  status,
  read_at: status === "lei" ? "2026-01-01" : null,
  cover_url: "https://covers.openlibrary.org/b/id/1-L.jpg",
  isbn: extra.isbn ?? "9781111111111",
  source: "openlibrary",
  external_id: extra.external_id ?? `/works/${title}`,
  page_count: 180,
  published_year: "2011",
  genre: null,
  synopsis: null,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  ...extra,
});

const shared = (title: string, extra: Partial<SharedBook> = {}): SharedBook => ({
  title,
  author: "Autor",
  coverUrl: "https://covers.openlibrary.org/b/id/2-L.jpg",
  isbn: extra.isbn ?? "9782222222222",
  source: "openlibrary",
  externalId: extra.externalId ?? `/works/${title}`,
  page_count: 318,
  published_year: "2005",
  genre: null,
  synopsis: null,
  leiCount: 1,
  quieroCount: 0,
  ...extra,
});

describe("searchQueries", () => {
  test("builds Spanish queries from the answers and the Leí seed", () => {
    const queries = searchQueries(answers);
    expect(queries[0]).toContain("novela policial");
    expect(queries[0]).toContain("oscuro");
    expect(queries.some((query) => query.includes("Rayuela"))).toBe(true);
  });
});

describe("buildCandidates", () => {
  test("drops coverless books, books already in Leí, and books with no id", () => {
    const catalogBooks = [
      catalog("Visible", { externalId: "/works/1", isbn: "9780000000001" }),
      catalog("Sin tapa", { coverUrl: null, externalId: "/works/2", isbn: "9780000000002" }),
      catalog("Ya leído", { isbn: "9781111111111", externalId: "/works/3" }),
    ];
    const owned = [libraryBook("Ya leído", "lei", { isbn: "9781111111111" })];
    const candidates = buildCandidates(answers, catalogBooks, owned, []);
    expect(candidates.map((book) => book.title)).toEqual(["Visible"]);
    expect(candidateId({ title: "x", author: "y" })).toBeNull();
  });

  test("puts matching Quiero books first and boosts Gilada", () => {
    const want = libraryBook("En la lista", "quiero", { isbn: "9783333333333", external_id: "/works/w" });
    const gilada = shared("De la gilada", { isbn: "9782222222222" });
    const extra = catalog("Otro", { isbn: "9780000000009", externalId: "/works/o" });
    const candidates = buildCandidates(answers, [extra], [want], [gilada]);
    expect(candidates[0]?.title).toBe("En la lista");
    expect(candidates[0]?.inQuiero).toBe(true);
    expect(candidates.find((book) => book.title === "De la gilada")?.inGilada).toBe(true);
  });
});

describe("value lines and sanitizing", () => {
  const book = { title: "Ficciones", page_count: 200, published_year: "1944" };
  const flags = { inGilada: false, inQuiero: false, anchor: answers.anchor };

  test("builds a concrete line from real fields", () => {
    expect(valueLine(book, flags)).toBe("200 pág. Como Rayuela (746 pág.).");
    expect(valueLine(book, { inGilada: true })).toBe("200 pág. Lo lee la gilada.");
    expect(valueLine({ ...book, page_count: null }, { inGilada: true })).toBe("Lo lee la gilada.");
  });

  test("drops a model line that invents numbers or generic copy", () => {
    expect(sanitizeLine("450 pág.", book, flags)).toBe("200 pág. Como Rayuela (746 pág.).");
    expect(sanitizeLine("Perfecto para vos", book, flags)).toBe("200 pág. Como Rayuela (746 pág.).");
    expect(sanitizeLine("200 pág.", book, flags)).toBe("200 pág.");
  });
});

describe("fillPicks and the model", () => {
  const base = (id: string, title: string): LeoCandidate => ({
    id,
    title,
    author: "Autor",
    coverUrl: "https://covers.openlibrary.org/b/id/1-L.jpg",
    isbn: "9780000000000",
    source: "openlibrary",
    externalId: id,
    page_count: 120,
    published_year: "2010",
    genre: null,
    synopsis: null,
    subjects: [],
    categories: [],
    buyLink: null,
    language: "es",
    inQuiero: false,
    inGilada: false,
    score: 1,
  });
  const pool = ["a", "b", "c", "d", "e", "f", "g"].map((id) => base(id, id.toUpperCase()));

  test("keeps only ids from the candidates and fills up to 6", () => {
    const picks = fillPicks(["b", "inventado", "a"], new Map([["b", "120 pág."]]), pool, answers);
    expect(picks.map((book) => book.id)).toEqual(["b", "a", "c", "d", "e", "f"]);
    expect(picks).toHaveLength(6);
    expect(picks[0]?.value).toBe("120 pág.");
  });

  test("uses the ranked fallback when the model fails or returns junk", async () => {
    const failed = await pickWithModel({ run: async () => { throw new Error("down"); } }, answers, pool);
    expect(failed.map((book) => book.id)).toEqual(["a", "b", "c", "d", "e", "f"]);
    const junk = await pickWithModel({ run: async () => ({ response: "no json" }) }, answers, pool);
    expect(junk).toHaveLength(6);
  });

  test("asks the JSON-schema model and keeps a valid id order", async () => {
    const calls: unknown[] = [];
    const ai = {
      run: async (model: string, body: unknown) => {
        calls.push([model, body]);
        return { response: { picks: [{ id: "g", line: "120 pág." }, { id: "a", line: "120 pág." }] } };
      },
    };
    const picks = await pickWithModel(ai, answers, pool);
    expect(picks[0]?.id).toBe("g");
    expect(picks[1]?.id).toBe("a");
    const [, body] = calls[0] as [string, { response_format: { type: string }; temperature: number }];
    expect(body.temperature).toBe(0);
    expect(body.response_format.type).toBe("json_schema");
  });
});
