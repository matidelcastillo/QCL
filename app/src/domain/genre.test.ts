import { describe, expect, test } from "bun:test";
import { genreGroup, groupByGenre, parseGenre } from "./genre";

describe("parseGenre", () => {
  test("keeps an exact label from the list, anything else is Otros", () => {
    expect(parseGenre(" Ciencia ficción ")).toBe("Ciencia ficción");
    expect(parseGenre("Otros")).toBe("Otros");
    expect(parseGenre("Science fiction")).toBe("Otros");
    expect(parseGenre("Novela.")).toBe("Otros");
    expect(parseGenre("")).toBe("Otros");
  });
});

describe("groupByGenre", () => {
  test("known genres sort alphabetically, the rest fall into Otros last", () => {
    const groups = groupByGenre([
      { genre: "Terror" },
      { genre: "Chronology" },
      { genre: null },
      { genre: "Ciencia ficción" },
      { genre: "Terror" },
      { genre: "Otros" },
    ]);
    expect(groups.map(([name, items]) => [name, items.length])).toEqual([
      ["Ciencia ficción", 1],
      ["Terror", 2],
      ["Otros", 3],
    ]);
    expect(genreGroup("Novela")).toBe("Novela");
  });
});
