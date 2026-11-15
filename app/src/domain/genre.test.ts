import { describe, expect, test } from "bun:test";
import { genreFromSubjects, genreGroup, groupByGenre } from "./genre";

describe("genreFromSubjects", () => {
  test("most votes win; the generic novel loses to a specific genre", () => {
    expect(
      genreFromSubjects(["Cosmology", "Physics", "Astronomy", "Philosophie", "Science, history"]),
    ).toBe("Ciencia");
    expect(genreFromSubjects(["Fiction / Horror"])).toBe("Terror");
    expect(genreFromSubjects(["Science fiction -- Argentina"])).toBe("Ciencia ficción");
  });
  test("topical 'X, fiction' and nonfiction do not vote novel", () => {
    expect(genreFromSubjects(["American Horror tales", "Gods, fiction", "Death, fiction"])).toBe(
      "Terror",
    );
    expect(genreFromSubjects(["Business", "Nonfiction"])).toBe("Negocios");
    expect(genreFromSubjects(["Spanish fiction", "Fiction, general", "Chronology"])).toBe("Novela");
  });
  test("noise only is no genre", () => {
    expect(genreFromSubjects(["Chronology", "Accessible book", "Argentina"])).toBeNull();
    expect(genreFromSubjects("Fiction")).toBeNull();
  });
});

describe("groupByGenre", () => {
  test("known genres sort alphabetically, unknown ones fall into Otros last", () => {
    const groups = groupByGenre([
      { genre: "Terror" },
      { genre: "Chronology" },
      { genre: null },
      { genre: "Ciencia ficción" },
      { genre: "Terror" },
    ]);
    expect(groups.map(([name, items]) => [name, items.length])).toEqual([
      ["Ciencia ficción", 1],
      ["Terror", 2],
      ["Otros", 2],
    ]);
    expect(genreGroup("Novela")).toBe("Novela");
  });
});
