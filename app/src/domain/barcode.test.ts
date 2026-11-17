import { beforeAll, describe, expect, test } from "bun:test";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
import { ISBN_READER_OPTIONS, barcodeFromResults, isbnFromResults } from "./barcode";
import type { ReadResult } from "zxing-wasm/reader";

const L = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
];
const PARITY = [
  "LLLLLL",
  "LLGLGL",
  "LLGGLG",
  "LLGGGL",
  "LGLLGG",
  "LGGLLG",
  "LGGGLL",
  "LGLGLG",
  "LGLGGL",
  "LGGLGL",
];
const invert = (bits: string) => bits.replace(/./g, (bit) => (bit === "1" ? "0" : "1"));

function ean13Modules(code: string): string {
  const digits = [...code].map(Number);
  const left = digits
    .slice(1, 7)
    .map((digit, index) =>
      PARITY[digits[0]][index] === "L" ? L[digit] : [...invert(L[digit])].reverse().join(""),
    );
  const right = digits.slice(7).map((digit) => invert(L[digit]));
  return `101${left.join("")}01010${right.join("")}101`;
}

/* Grayscale camera-like frame: 4 px per module, quiet zones, optional blur. */
function frame(code: string, sigma: number): ImageData {
  const modules = `${"0".repeat(11)}${ean13Modules(code)}${"0".repeat(11)}`;
  const width = modules.length * 4;
  const height = 200;
  let gray = new Float32Array(width * height);
  for (let x = 0; x < width; x++) {
    const value = modules[Math.floor(x / 4)] === "1" ? 30 : 230;
    for (let y = 0; y < height; y++) gray[y * width + x] = value;
  }
  if (sigma > 0) {
    const radius = Math.ceil(sigma * 3);
    const kernel = Array.from({ length: radius * 2 + 1 }, (_, i) =>
      Math.exp(-((i - radius) ** 2) / (2 * sigma ** 2)),
    );
    const total = kernel.reduce((sum, weight) => sum + weight, 0);
    const blurred = new Float32Array(gray.length);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++)
          sum += gray[y * width + Math.min(width - 1, Math.max(0, x + k))] * kernel[k + radius];
        blurred[y * width + x] = sum / total;
      }
    gray = blurred;
  }
  const data = new Uint8ClampedArray(width * height * 4);
  gray.forEach((value, i) => data.set([value, value, value, 255], i * 4));
  return { data, width, height, colorSpace: "srgb" } as ImageData;
}

const read = async (image: ImageData) =>
  isbnFromResults(await readBarcodes(image, ISBN_READER_OPTIONS));

describe("ISBN barcode reader", () => {
  /* Compiling the WASM module takes a few seconds the first time. */
  beforeAll(() => prepareZXingModule({ fireImmediately: true }), 30_000);

  test("reads a sharp and a blurred EAN-13", async () => {
    expect(await read(frame("9788471893147", 0))).toBe("9788471893147");
    expect(await read(frame("9788471893147", 1.5))).toBe("9788471893147");
  });
  test("ignores EAN-13 codes that are not ISBNs", async () => {
    expect(await read(frame("7791234567898", 0))).toBeNull();
  });
});

describe("barcodeFromResults", () => {
  test("splits ISBN, non-ISBN and empty reads", () => {
    const result = (text: string, isValid = true) => ({ isValid, text }) as ReadResult;
    expect(barcodeFromResults([result("9788471893147")])).toEqual({
      kind: "isbn",
      isbn: "9788471893147",
    });
    expect(barcodeFromResults([result("7791234567898")])).toEqual({ kind: "invalid" });
    expect(barcodeFromResults([result("9788471893147", false)])).toEqual({ kind: "none" });
    expect(barcodeFromResults([])).toEqual({ kind: "none" });
  });
});
