import { describe, expect, test } from "bun:test";
import { cleanGenre, firstAuthors, plainText } from "./metadata";

describe("catalog metadata", () => {
  test("skips noisy subjects and translates a useful one", () => {
    expect(cleanGenre(["History and criticism", "Science fiction -- Argentina"])).toBe(
      "Ciencia ficción",
    );
    expect(cleanGenre(["General", "20th century"])).toBeNull();
  });
  test("uses two authors only when exactly two exist", () => {
    expect(firstAuthors(["Uno", "Dos"])).toBe("Uno, Dos");
    expect(firstAuthors(["Uno", "Dos", "Tres"])).toBe("Uno");
  });
  test("removes markup from synopsis", () => {
    expect(plainText("<p>Hola <b>mundo</b></p>")).toBe("Hola mundo");
  });
});
