import { describe, expect, test } from "bun:test";
import {
  clampForText,
  contrastWithWhite,
  isNearBlack,
  isNearWhite,
  paletteFromSamples,
  relativeLuminance,
} from "../../src/lib/cover-colors.ts";
import {
  googleIsbnCoverUrl,
  googleIsbnCoverUrls,
  isbnFromCoverUrl,
  isAllowedTapaUrl,
  isUsableCoverPayload,
  tapaSrc,
} from "../../src/lib/tapa.ts";

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

  test("passes an ISBN so the proxy can try a Google Books cover first", () => {
    expect(
      tapaSrc("https://covers.openlibrary.org/b/id/8097558-L.jpg?default=false", "9780262062664"),
    ).toBe(
      "/api/tapa?u=https%3A%2F%2Fcovers.openlibrary.org%2Fb%2Fid%2F8097558-L.jpg%3Fdefault%3Dfalse&isbn=9780262062664",
    );
    expect(isbnFromCoverUrl("https://covers.openlibrary.org/b/isbn/9788437604572-L.jpg")).toBe(
      "9788437604572",
    );
    expect(googleIsbnCoverUrl("9788437604572")).toBe(
      "https://books.google.com/books/content?vid=ISBN9788437604572&printsec=frontcover&img=1&zoom=2",
    );
    const jpeg = new Uint8Array(3000);
    jpeg[0] = 0xff;
    jpeg[1] = 0xd8;
    jpeg[2] = 0xff;
    expect(isUsableCoverPayload("image/jpeg", jpeg.buffer)).toBe(true);
    expect(isUsableCoverPayload("image/jpeg", jpeg.buffer, "google")).toBe(true);
    const stub = new Uint8Array(1269);
    stub[0] = 0x89;
    stub[1] = 0x50;
    stub[2] = 0x4e;
    expect(isUsableCoverPayload("image/png", stub.buffer)).toBe(false);
    const unavailable = new Uint8Array(9103);
    unavailable[0] = 0x89;
    unavailable[1] = 0x50;
    unavailable[2] = 0x4e;
    expect(isUsableCoverPayload("image/png", unavailable.buffer)).toBe(true);
    expect(isUsableCoverPayload("image/png", unavailable.buffer, "google")).toBe(false);
    expect(googleIsbnCoverUrls("9788437604572")).toEqual([
      "https://books.google.com/books/content?vid=ISBN9788437604572&printsec=frontcover&img=1&zoom=2",
      "https://books.google.com/books/content?vid=ISBN9788437604572&printsec=frontcover&img=1&zoom=1",
    ]);
  });
});
