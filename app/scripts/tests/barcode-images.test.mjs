import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeIsbnFromRgba } from "../../src/lib/barcode-decode.ts";
import { isbnFromBarcode } from "../../src/lib/isbn.ts";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "barcodes");

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
const R = L.map((pattern) =>
  pattern.replaceAll("0", "x").replaceAll("1", "0").replaceAll("x", "1"),
);
const G = R.map((pattern) => [...pattern].reverse().join(""));
const LEFT_PARITY = [
  "LLLLLL",
  "LLGLGG",
  "LLGGLG",
  "LLGGGL",
  "LGLLGG",
  "LGGLLG",
  "LGGGLL",
  "LGLGLG",
  "LGLGGL",
  "LGGLGL",
];
const EAN5_PARITY = [
  "GGLLL",
  "GLGLL",
  "GLLGL",
  "GLLLG",
  "LGGLL",
  "LLGGL",
  "LLLGG",
  "LGLGL",
  "LGLLG",
  "LLGLG",
];

function ean13Modules(digits) {
  const parity = LEFT_PARITY[Number(digits[0])];
  let bits = "101";
  for (let index = 0; index < 6; index += 1) {
    const set = parity[index] === "G" ? G : L;
    bits += set[Number(digits[index + 1])];
  }
  bits += "01010";
  for (let index = 7; index < 13; index += 1) {
    bits += R[Number(digits[index])];
  }
  bits += "101";
  return bits;
}

function ean5Modules(digits) {
  const checksum =
    digits
      .split("")
      .reduce((sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 3 : 9), 0) % 10;
  const parity = EAN5_PARITY[checksum];
  let bits = "01011";
  for (let index = 0; index < 5; index += 1) {
    if (index > 0) bits += "01";
    const set = parity[index] === "G" ? G : L;
    bits += set[Number(digits[index])];
  }
  return bits;
}

function renderModules(
  modules,
  { scale = 3, barHeight = 90, pad = 28, left = modules, gap = 0, right = "" } = {},
) {
  const bits = `${left}${"0".repeat(gap)}${right || ""}`;
  const width = bits.length * scale + pad * 2;
  const height = barHeight + pad * 2;
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(255);
  for (let y = pad; y < pad + barHeight; y += 1) {
    for (let x = 0; x < bits.length; x += 1) {
      if (bits[x] !== "1") continue;
      for (let dx = 0; dx < scale; dx += 1) {
        const offset = (y * width + pad + x * scale + dx) * 4;
        data[offset] = 0;
        data[offset + 1] = 0;
        data[offset + 2] = 0;
        data[offset + 3] = 255;
      }
    }
  }
  return { data, width, height };
}

function downscaleThenUp(image, factor = 2) {
  const smallW = Math.max(32, Math.floor(image.width / factor));
  const smallH = Math.max(16, Math.floor(image.height / factor));
  const small = new Uint8ClampedArray(smallW * smallH * 4);
  for (let y = 0; y < smallH; y += 1) {
    for (let x = 0; x < smallW; x += 1) {
      const sx = Math.min(image.width - 1, Math.floor((x + 0.5) * (image.width / smallW)));
      const sy = Math.min(image.height - 1, Math.floor((y + 0.5) * (image.height / smallH)));
      const src = (sy * image.width + sx) * 4;
      small.set(image.data.subarray(src, src + 4), (y * smallW + x) * 4);
    }
  }
  const data = new Uint8ClampedArray(image.width * image.height * 4);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const sx = Math.min(smallW - 1, Math.floor((x + 0.5) * (smallW / image.width)));
      const sy = Math.min(smallH - 1, Math.floor((y + 0.5) * (smallH / image.height)));
      data.set(
        small.subarray((sy * smallW + sx) * 4, (sy * smallW + sx) * 4 + 4),
        (y * image.width + x) * 4,
      );
    }
  }
  return { data, width: image.width, height: image.height };
}

async function decodePngFile(path) {
  const { PNG } = await import("pngjs");
  const png = PNG.sync.read(Buffer.from(await Bun.file(path).arrayBuffer()));
  return decodeIsbnFromRgba(Uint8ClampedArray.from(png.data), png.width, png.height, {
    mode: "thorough",
  });
}

describe("barcode decode", () => {
  test("reads a generated ISBN-13, even with a 5-digit add-on or blur", () => {
    const modules = ean13Modules("9780262062664");
    const clean = renderModules(modules);
    expect(decodeIsbnFromRgba(clean.data, clean.width, clean.height)).toBe("9780262062664");

    const withAddon = renderModules(modules, {
      left: modules,
      gap: 12,
      right: ean5Modules("90000"),
    });
    expect(decodeIsbnFromRgba(withAddon.data, withAddon.width, withAddon.height)).toBe(
      "9780262062664",
    );

    const blurry = downscaleThenUp(clean, 2);
    expect(decodeIsbnFromRgba(blurry.data, blurry.width, blurry.height)).toBe("9780262062664");
  });

  test("decodes cropped phone barcode fixtures when present", async () => {
    if (!existsSync(fixtureDir)) return;
    const files = readdirSync(fixtureDir)
      .filter((name) => name.endsWith(".png"))
      .sort();
    if (files.length === 0) return;
    for (const name of files) {
      const isbn = await decodePngFile(join(fixtureDir, name));
      expect(isbn).not.toBeNull();
      expect(isbnFromBarcode(isbn)).toBe(isbn);
    }
  });
});
