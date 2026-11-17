import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./gilada.tsx", import.meta.url)).text();

describe("Gilada view", () => {
  test("is always the same 3-column cover grid as home, with no list toggle", () => {
    expect(source).toContain("book-grid");
    expect(source).toContain("BookTile");
    expect(source).not.toContain("SharedBookRow");
    expect(source).not.toContain("LayoutGrid");
    expect(source).not.toContain("filter-action");
    expect(source).not.toContain("setView");
    expect(source).not.toMatch(/localStorage|sessionStorage/);
  });
});
