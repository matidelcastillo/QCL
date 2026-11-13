import { describe, expect, test } from "bun:test";
import { allowedCoverUrl, validCover } from "./cover";

function png(width: number, height: number, bytes = 2500) {
  const image = new Uint8Array(bytes);
  image.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(image.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return image;
}

describe("cover proxy gate", () => {
  test("accepts only HTTPS allowlisted hosts", () => {
    expect(allowedCoverUrl("https://covers.openlibrary.org/b/id/1-L.jpg")).not.toBeNull();
    expect(allowedCoverUrl("http://covers.openlibrary.org/b/id/1-L.jpg")).toBeNull();
    expect(allowedCoverUrl("https://books.google.com.evil.example/cover")).toBeNull();
  });
  test("rejects undersized and known placeholder dimensions", () => {
    expect(validCover(png(300, 391), "image/png")).toBe(false);
    expect(validCover(png(99, 300), "image/png")).toBe(false);
    expect(validCover(png(200, 300, 1000), "image/png")).toBe(false);
    expect(validCover(png(200, 300), "image/png")).toBe(true);
  });
});
