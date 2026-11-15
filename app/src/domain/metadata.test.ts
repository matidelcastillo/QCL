import { describe, expect, test } from "bun:test";
import { firstAuthors, plainText } from "./metadata";

describe("catalog metadata", () => {
  test("uses two authors only when exactly two exist", () => {
    expect(firstAuthors(["Uno", "Dos"])).toBe("Uno, Dos");
    expect(firstAuthors(["Uno", "Dos", "Tres"])).toBe("Uno");
  });
  test("removes markup from synopsis", () => {
    expect(plainText("<p>Hola <b>mundo</b></p>")).toBe("Hola mundo");
  });
});
