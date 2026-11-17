import { describe, expect, test } from "bun:test";
import { allowedCoverUrl, readBody, validCover } from "./cover";

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

describe("cover body cap", () => {
  test("stops reading when the streamed body exceeds the cap", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(1_000_000));
        controller.enqueue(new Uint8Array(1_000_001));
        controller.close();
      },
    });
    expect(await readBody(new Response(stream))).toBeNull();
  });

  test("rejects a content-length over the cap", async () => {
    const response = new Response(png(200, 300), { headers: { "content-length": "2000001" } });
    expect(await readBody(response)).toBeNull();
  });

  test("reads a body under the cap when content-length is missing", async () => {
    const payload = png(200, 300);
    const bytes = await readBody(new Response(payload));
    expect(bytes).not.toBeNull();
    expect(bytes?.byteLength).toBe(payload.byteLength);
  });
});
