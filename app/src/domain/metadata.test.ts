import { describe, expect, test } from "bun:test";
import { cleanGenre, firstAuthors, plainText } from "./metadata";

describe("catalog metadata", () => {
  test("keeps only known genres, in Spanish, specific before Novela", () => {
    expect(cleanGenre(["History and criticism", "Science fiction -- Argentina"])).toBe(
      "Ciencia ficción",
    );
    expect(cleanGenre(["General", "20th century", "Fiction"])).toBeNull();
    expect(cleanGenre(["Social life and customs", "Spanish fiction", "Novela"])).toBe("Novela");
    expect(cleanGenre(["Anachronisms", "Novela", "Short stories"])).toBe("Cuentos");
    expect(cleanGenre(["Fiction / Fantasy / General"])).toBe("Fantasía");
    expect(cleanGenre(["Crítica e interpretación", "Accessible book", "Argentina"])).toBeNull();
  });
  test("uses two authors only when exactly two exist", () => {
    expect(firstAuthors(["Uno", "Dos"])).toBe("Uno, Dos");
    expect(firstAuthors(["Uno", "Dos", "Tres"])).toBe("Uno");
  });
  test("removes markup from synopsis", () => {
    expect(plainText("<p>Hola <b>mundo</b></p>")).toBe("Hola mundo");
  });
});
