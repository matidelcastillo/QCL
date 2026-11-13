import { describe, expect, test } from "bun:test";
import type { SharedBook } from "../domain/types";
import { sharedCounts } from "./shared-books";

const book = (leiCount: number, quieroCount: number): SharedBook => ({
  title: "Ficciones",
  author: "Jorge Luis Borges",
  coverUrl: null,
  isbn: null,
  source: "manual",
  externalId: null,
  page_count: null,
  published_year: null,
  genre: null,
  synopsis: null,
  leiCount,
  quieroCount,
});

describe("sharedCounts", () => {
  test("plural and singular, zero parts hidden", () => {
    expect(sharedCounts(book(2, 1))).toEqual(["2 lo leyeron", "1 lo quiere"]);
    expect(sharedCounts(book(1, 0))).toEqual(["1 lo leyó"]);
    expect(sharedCounts(book(0, 3))).toEqual(["3 lo quieren"]);
  });
});
