import { describe, expect, test } from "bun:test";
import { coverImageClass } from "./cover-reveal";

describe("cover reveal", () => {
  test("a first load starts without is-loaded so the fade can play", () => {
    expect(coverImageClass("row", false)).toBe("cover-image qc-card-image");
    expect(coverImageClass("tile", false)).toBe("cover-image qc-card-image");
    expect(coverImageClass("large", false)).toBe("cover-image drawer-media-fade");
  });

  test("a cached cover mounts already loaded and does not re-animate", () => {
    expect(coverImageClass("row", true)).toBe("cover-image qc-card-image is-loaded");
    expect(coverImageClass("tile", true)).toBe("cover-image qc-card-image is-loaded");
    expect(coverImageClass("large", true)).toBe("cover-image drawer-media-fade is-loaded");
  });
});

describe("motion tokens", () => {
  const tokens = Bun.file(new URL("../styles/tokens.css", import.meta.url));
  const css = Bun.file(new URL("../styles/components.css", import.meta.url));

  test("cover and sheet motion use dedicated tokens", async () => {
    const t = await tokens.text();
    expect(t).toContain("--qcl-image-fade:");
    expect(t).toContain("--qcl-cover-from-scale: 0.96");
    expect(t).toContain("--qcl-cover-scale-dur:");
    expect(t).toContain("--ease-cover:");
    expect(t).toContain("--dur-sheet:");
    expect(t).toContain("--ease-sheet:");
    const styles = await css.text();
    expect(styles).toContain("scale(var(--qcl-cover-from-scale))");
    expect(styles).toContain("opacity var(--qcl-image-fade) var(--ease-cover)");
    expect(styles).toContain("transform var(--qcl-cover-scale-dur) var(--ease-cover)");
    expect(styles).toContain("transform var(--dur-sheet) var(--ease-sheet)");
  });

  test("prefers-reduced-motion snaps covers and kills transitions", async () => {
    const styles = await css.text();
    const reduce = styles.split("@media (prefers-reduced-motion: reduce)")[1] ?? "";
    expect(reduce).toContain("transition: none !important");
    expect(reduce).toContain("animation: none !important");
    expect(reduce).toContain("transform: none");
    expect(reduce).toMatch(/\.qc-card-image[\s\S]*opacity: 1/);
  });
});
