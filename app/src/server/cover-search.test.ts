import { afterEach, expect, test } from "bun:test";
import { allowedCoverUrl } from "./cover";
import { findCover, isbnCoverUrls } from "./cover-search";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function jpeg(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(4096);
  bytes.set([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 255,
    width >> 8,
    width & 255,
  ]);
  return bytes;
}

test("every ISBN source is allowlisted, Amazon only with an ISBN-10", () => {
  const urls = isbnCoverUrls("9788471893147");
  expect(urls).toHaveLength(4);
  expect(urls.every((url) => allowedCoverUrl(url))).toBe(true);
  expect(urls[2]).toContain("/t5/47/9788471893147.jpg");
  expect(urls[3]).toContain("/P/8471893142.");
  expect(isbnCoverUrls("9791032305690")).toHaveLength(3);
});

test("falls through missing sources to the first real cover", async () => {
  const asked: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    asked.push(new URL(url).host);
    return url.includes("media-amazon")
      ? new Response(jpeg(322, 500) as BodyInit, { headers: { "content-type": "image/jpeg" } })
      : new Response("", { status: 404 });
  }) as unknown as typeof fetch;
  const cover = await findCover({ url: null, isbn: "9788471893147", title: "", author: "" });
  expect(cover?.sourceUrl).toContain("m.media-amazon.com");
  expect(asked).toEqual([
    "covers.openlibrary.org",
    "books.google.com",
    "imagessl.casadellibro.com",
    "m.media-amazon.com",
  ]);
});
