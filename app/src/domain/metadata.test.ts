import { describe, expect, test } from "bun:test";
import { firstAuthors, plainText, year, workTitle, authorKey } from "./metadata";

describe("catalog metadata", () => {
  test("uses two authors only when exactly two exist", () => {
    expect(firstAuthors(["Uno", "Dos"])).toBe("Uno, Dos");
    expect(firstAuthors(["Uno", "Dos", "Tres"])).toBe("Uno");
  });
  test("removes markup from synopsis", () => {
    expect(plainText("<p>Hola <b>mundo</b></p>")).toBe("Hola mundo");
  });
});

describe("year", () => {
  test("reads a four-digit year from a date or a number", () => {
    expect(year("2010-01-26")).toBe("2010");
    expect(year(2010)).toBe("2010");
    expect(year("2008")).toBe("2008");
  });

  test("drops an isolated early year next to a cluster of edition dates", () => {
    expect(year("1960", ["April 26, 2011", "Jun 01, 2012", "2010"])).toBe("2010");
    expect(year("1960", "2010")).toBe("2010");
  });

  test("keeps a single plausible year and ignores junk", () => {
    expect(year("1960")).toBe("1960");
    expect(year("no date")).toBeNull();
    expect(year("2999")).toBeNull();
  });
});

describe("work titles", () => {
  test("strips an author prefix or suffix and keeps the work name", () => {
    expect(workTitle("Julio Cortazar, Rayuela", "Julio Cortázar")).toBe("Rayuela");
    expect(workTitle("Rayuela - Julio Cortázar", "Julio Cortázar")).toBe("Rayuela");
    expect(workTitle("Rayuela / Cortázar, Julio", "Julio Cortázar")).toBe("Rayuela");
    expect(workTitle("Circe (AdN)", "Madeline Miller")).toBe("Circe");
    expect(workTitle("Rayuela", "Julio Cortázar")).toBe("Rayuela");
  });

  test("does not strip a last name that is part of the title", () => {
    expect(workTitle("West of the Sun", "Paul West")).toBe("West of the Sun");
  });

  test("authorKey treats inverted names as the same person", () => {
    expect(authorKey("Julio Cortázar")).toBe(authorKey("Cortázar, Julio"));
  });
});
