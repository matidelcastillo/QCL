import { describe, expect, test } from "bun:test";
import { isCoverRevealed } from "./use-cover-status";

describe("cover reveal", () => {
  test("hides a book until its cover reports ready or miss, then shows it", () => {
    const status: Record<string, "ready" | "miss"> = { a: "ready", b: "miss" };
    expect(isCoverRevealed({}, "a")).toBe(false);
    expect(isCoverRevealed(status, "a")).toBe(true);
    expect(isCoverRevealed(status, "b")).toBe(true);
    expect(isCoverRevealed(status, "c")).toBe(false);
  });

  test("Mis libros list and grid wait on onCover, and still show a miss", async () => {
    const source = await Bun.file(new URL("../routes/index.tsx", import.meta.url)).text();
    expect(source).toContain("useCoverStatus");
    expect(source).toContain("isCoverRevealed");
    expect(source).toContain("onCover={(value) => report(book.id, value)}");
    expect(source).toContain("hidden={!isCoverRevealed(status, book.id)}");
    expect(source).toContain("eager");
  });

  test("Gilada waits on the same cover hook", async () => {
    const source = await Bun.file(new URL("../routes/gilada.tsx", import.meta.url)).text();
    expect(source).toContain("useCoverStatus");
    expect(source).toContain("isCoverRevealed");
    expect(source).toContain("onCover");
  });

  test("book tiles fill a cover-wait wrapper so the grid does not collapse", async () => {
    const styles = await Bun.file(new URL("../styles/components.css", import.meta.url)).text();
    const rule = styles.split(".book-tile {")[1]?.split("}")[0] ?? "";
    expect(rule).toContain("width: 100%");
    expect(rule).toContain("aspect-ratio: var(--qcl-cover-ratio)");
  });
});
