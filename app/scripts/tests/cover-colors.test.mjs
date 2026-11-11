import { describe, expect, test } from "bun:test";
import {
  clampForText,
  contrastWithWhite,
  isNearBlack,
  isNearWhite,
  paletteFromSamples,
  relativeLuminance,
} from "../../src/lib/cover-colors.ts";
import { isAllowedTapaUrl, tapaSrc } from "../../src/lib/tapa.ts";

describe("cover colors", () => {
  test("treats near-white and near-black as unusable", () => {
    expect(isNearWhite(255, 255, 255)).toBe(true);
    expect(isNearWhite(248, 246, 242)).toBe(true);
    expect(isNearBlack(0, 0, 0)).toBe(true);
    expect(isNearBlack(8, 8, 10)).toBe(true);
    expect(isNearWhite(200, 40, 30)).toBe(false);
    expect(isNearBlack(180, 40, 30)).toBe(false);
  });

  test("falls back when samples are only white or black", () => {
    const white = Array.from({ length: 20 }, () => [252, 252, 250]);
    const black = Array.from({ length: 20 }, () => [5, 5, 5]);
    expect(paletteFromSamples(white)).toBeNull();
    expect(paletteFromSamples(black)).toBeNull();
  });

  test("clamps a light or loud color so white text stays readable", () => {
    const light = clampForText(250, 210, 180);
    const loud = clampForText(255, 80, 60);
    expect(contrastWithWhite(light.r, light.g, light.b)).toBeGreaterThanOrEqual(4.5);
    expect(contrastWithWhite(loud.r, loud.g, loud.b)).toBeGreaterThanOrEqual(4.5);
    expect(relativeLuminance(light.r, light.g, light.b)).toBeLessThan(0.2);
  });

  test("builds a palette from saturated cover samples", () => {
    const reds = Array.from({ length: 30 }, () => [180, 40, 30]);
    const greens = Array.from({ length: 20 }, () => [30, 90, 50]);
    const palette = paletteFromSamples([...reds, ...greens]);
    expect(palette).not.toBeNull();
    expect(palette.c1.startsWith("rgb(")).toBe(true);
    expect(palette.c2.startsWith("rgb(")).toBe(true);
    expect(palette.c1).not.toBe(palette.c2);
  });
});

describe("tapa urls", () => {
  test("allows public https covers and blocks private hosts", () => {
    expect(isAllowedTapaUrl("https://covers.openlibrary.org/b/id/1-L.jpg")).not.toBeNull();
    expect(isAllowedTapaUrl("http://127.0.0.1/x.jpg")).toBeNull();
    expect(isAllowedTapaUrl("http://localhost/x.jpg")).toBeNull();
    expect(isAllowedTapaUrl("http://192.168.0.10/x.jpg")).toBeNull();
    expect(isAllowedTapaUrl("http://10.0.0.2/x.jpg")).toBeNull();
    expect(isAllowedTapaUrl("file:///etc/passwd")).toBeNull();
  });

  test("points remote covers at the same-origin proxy", () => {
    expect(tapaSrc(null)).toBeNull();
    expect(tapaSrc("https://covers.openlibrary.org/b/id/1-L.jpg")).toBe(
      "/api/tapa?u=https%3A%2F%2Fcovers.openlibrary.org%2Fb%2Fid%2F1-L.jpg",
    );
    expect(tapaSrc("data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
  });
});
