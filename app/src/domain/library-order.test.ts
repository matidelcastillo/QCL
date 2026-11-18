import { describe, expect, test } from "bun:test";
import {
  compareReadBooks,
  libraryViewBooks,
  libraryViewGroups,
  sortLibraryBooks,
} from "./library-order";

const book = (
  id: string,
  created_at: string,
  genre: string | null,
  extra: { read_at?: string | null } = {},
) => ({
  id,
  created_at,
  genre,
  read_at: extra.read_at ?? null,
  title: id,
});

describe("library order", () => {
  test("sorts newest first and breaks created_at ties by id, without mutating the input", () => {
    const older = book("b", "2026-01-01T00:00:00Z", "Novela");
    const newer = book("a", "2026-06-01T00:00:00Z", "Terror");
    const tiedEarlierId = book("m", "2026-03-01T00:00:00Z", "Novela");
    const tiedLaterId = book("z", "2026-03-01T00:00:00Z", "Novela");
    const input = [older, tiedEarlierId, newer, tiedLaterId];
    expect(sortLibraryBooks(input).map((item) => item.id)).toEqual(["a", "z", "m", "b"]);
    expect(input.map((item) => item.id)).toEqual(["b", "m", "a", "z"]);
  });

  test("list groups and the grid flatten to the same stable sequence", () => {
    const visible = [
      book("old-novel", "2026-01-01T00:00:00Z", "Novela"),
      book("new-other", "2026-09-01T00:00:00Z", "Chronology"),
      book("new-novel", "2026-08-01T00:00:00Z", "Novela"),
      book("tied-a", "2026-05-01T00:00:00Z", "Terror"),
      book("tied-b", "2026-05-01T00:00:00Z", "Terror"),
    ];
    const groups = libraryViewGroups(visible);
    expect(groups.map(([name, items]) => [name, items.map((item) => item.id)])).toEqual([
      ["Novela", ["new-novel", "old-novel"]],
      ["Terror", ["tied-b", "tied-a"]],
      ["Otros", ["new-other"]],
    ]);
    expect(libraryViewBooks(visible).map((item) => item.id)).toEqual([
      "new-novel",
      "old-novel",
      "tied-b",
      "tied-a",
      "new-other",
    ]);
  });

  test("compareReadBooks breaks a tied read_at by id", () => {
    const first = { id: "a", read_at: "2026-11-01", created_at: "2026-01-01" };
    const second = { id: "b", read_at: "2026-11-01", created_at: "2026-02-01" };
    expect([second, first].sort(compareReadBooks).map((item) => item.id)).toEqual(["b", "a"]);
  });
});

describe("Biblioteca views share the helper", () => {
  test("Mis libros list and grid both call the shared view order", async () => {
    const source = await Bun.file(new URL("../routes/index.tsx", import.meta.url)).text();
    expect(source).toContain("libraryViewBooks(visible)");
    expect(source).toContain("libraryViewGroups(visible)");
    expect(source).not.toContain("groupByGenre(visible)");
  });
});
