import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HybridBinarizer,
  MultiFormatOneDReader,
  RGBLuminanceSource,
} from "@zxing/library";
import { isbnFromBarcode } from "@/lib/isbn";

export type DecodeMode = "live" | "thorough";

type Crop = { left: number; top: number; width: number; height: number };
type LumaImage = { data: Uint8ClampedArray; width: number; height: number };

export function bookBarcodeHints(): Map<DecodeHintType, unknown> {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return hints;
}

export function rgbaToLuminance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height);
  for (let index = 0, offset = 0; index < out.length; index += 1, offset += 4) {
    const red = data[offset] ?? 0;
    const green = data[offset + 1] ?? 0;
    const blue = data[offset + 2] ?? 0;
    out[index] = (red + 2 * green + blue) / 4;
  }
  return out;
}

export function cropRegions(width: number, height: number): Crop[] {
  const regions: Crop[] = [{ left: 0, top: 0, width, height }];
  const add = (left: number, top: number, cropWidth: number, cropHeight: number) => {
    const nextLeft = Math.max(0, Math.floor(left));
    const nextTop = Math.max(0, Math.floor(top));
    const nextWidth = Math.max(8, Math.min(width - nextLeft, Math.floor(cropWidth)));
    const nextHeight = Math.max(8, Math.min(height - nextTop, Math.floor(cropHeight)));
    if (nextWidth >= 32 && nextHeight >= 16) {
      regions.push({ left: nextLeft, top: nextTop, width: nextWidth, height: nextHeight });
    }
  };
  // Wide center band, larger than the on-screen guide.
  add(width * 0.04, height * 0.25, width * 0.92, height * 0.5);
  // Left-biased crop so a 5-digit add-on on the right is left out.
  add(width * 0.02, height * 0.28, width * 0.7, height * 0.44);
  // Tighter zoom on the middle of the frame.
  add(width * 0.1, height * 0.34, width * 0.8, height * 0.32);
  return regions;
}

function cropLuma(image: LumaImage, crop: Crop): LumaImage {
  if (
    crop.left === 0 &&
    crop.top === 0 &&
    crop.width === image.width &&
    crop.height === image.height
  ) {
    return image;
  }
  const data = new Uint8ClampedArray(crop.width * crop.height);
  for (let row = 0; row < crop.height; row += 1) {
    const start = (crop.top + row) * image.width + crop.left;
    data.set(image.data.subarray(start, start + crop.width), row * crop.width);
  }
  return { data, width: crop.width, height: crop.height };
}

function invertLuma(image: LumaImage): LumaImage {
  const data = new Uint8ClampedArray(image.data.length);
  for (let index = 0; index < image.data.length; index += 1) {
    data[index] = 255 - (image.data[index] ?? 0);
  }
  return { data, width: image.width, height: image.height };
}

function rotateLuma(image: LumaImage, turns: 1 | 2 | 3): LumaImage {
  const { data: src, width, height } = image;
  if (turns === 2) {
    const data = new Uint8ClampedArray(src.length);
    for (let index = 0, mirror = src.length - 1; index < src.length; index += 1, mirror -= 1) {
      data[index] = src[mirror] ?? 0;
    }
    return { data, width, height };
  }
  const nextWidth = height;
  const nextHeight = width;
  const data = new Uint8ClampedArray(src.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = src[y * width + x] ?? 0;
      if (turns === 1) {
        data[x * nextWidth + (height - 1 - y)] = value;
      } else {
        data[(width - 1 - x) * nextWidth + y] = value;
      }
    }
  }
  return { data, width: nextWidth, height: nextHeight };
}

function tryDecode(
  image: LumaImage,
  reader: MultiFormatOneDReader,
  hints: Map<DecodeHintType, unknown>,
): string | null {
  const source = new RGBLuminanceSource(image.data, image.width, image.height);
  const binarizers = [HybridBinarizer, GlobalHistogramBinarizer];
  const sources = [source, source.invert()];
  for (const luminance of sources) {
    for (const BinarizerType of binarizers) {
      try {
        const result = reader.decode(new BinaryBitmap(new BinarizerType(luminance)), hints);
        const isbn = isbnFromBarcode(result.getText());
        if (isbn) return isbn;
      } catch {
        // keep trying
      } finally {
        reader.reset();
      }
    }
  }
  return null;
}

function variantsFor(image: LumaImage, mode: DecodeMode, pass = 0): LumaImage[] {
  if (mode === "thorough") {
    return [image, rotateLuma(image, 2), rotateLuma(image, 1), rotateLuma(image, 3)];
  }
  const cycle = pass % 4;
  if (cycle === 1) return [image, invertLuma(image)];
  if (cycle === 2) return [image, rotateLuma(image, 1)];
  if (cycle === 3) return [image, rotateLuma(image, 3)];
  return [image, rotateLuma(image, 2)];
}

export function decodeIsbnFromRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: { mode?: DecodeMode; pass?: number } = {},
): string | null {
  if (width < 32 || height < 16) return null;
  const mode = options.mode ?? "thorough";
  const hints = bookBarcodeHints();
  const reader = new MultiFormatOneDReader(hints);
  const base: LumaImage = { data: rgbaToLuminance(data, width, height), width, height };
  for (const variant of variantsFor(base, mode, options.pass ?? 0)) {
    const regions = cropRegions(variant.width, variant.height);
    const crops =
      mode === "thorough"
        ? regions
        : [regions[0], regions[2] ?? regions[0], regions[1] ?? regions[0]];
    for (const crop of crops) {
      const isbn = tryDecode(cropLuma(variant, crop), reader, hints);
      if (isbn) return isbn;
    }
  }
  return null;
}
