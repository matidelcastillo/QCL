/** Palette math for list cards. Neutral colors are darkened QC warm tokens so white text stays readable. */

export type CoverPalette = { c1: string; c2: string };

/** color-mix of --gray-text/#6b6560 and --black, and darkened --gray-light/#e8e3dc. */
export const NEUTRAL_PALETTE: CoverPalette = {
  c1: "#4e4844",
  c2: "#6f675f",
};

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l };
  const s = delta / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = (bn - rn) / delta + 2;
  else h = (rn - gn) / delta + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (h % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rn = 0;
  let gn = 0;
  let bn = 0;
  if (hp < 1) [rn, gn, bn] = [c, x, 0];
  else if (hp < 2) [rn, gn, bn] = [x, c, 0];
  else if (hp < 3) [rn, gn, bn] = [0, c, x];
  else if (hp < 4) [rn, gn, bn] = [0, x, c];
  else if (hp < 5) [rn, gn, bn] = [x, 0, c];
  else [rn, gn, bn] = [c, 0, x];
  const m = l - c / 2;
  return {
    r: Math.round(clamp((rn + m) * 255, 0, 255)),
    g: Math.round(clamp((gn + m) * 255, 0, 255)),
    b: Math.round(clamp((bn + m) * 255, 0, 255)),
  };
}

export function relativeLuminance(r: number, g: number, b: number): number {
  const lin = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function contrastWithWhite(r: number, g: number, b: number): number {
  const lum = relativeLuminance(r, g, b);
  return 1.05 / (lum + 0.05);
}

export function isNearWhite(r: number, g: number, b: number): boolean {
  const { s, l } = rgbToHsl(r, g, b);
  return l >= 0.88 || (l >= 0.8 && s <= 0.12) || relativeLuminance(r, g, b) >= 0.85;
}

export function isNearBlack(r: number, g: number, b: number): boolean {
  const { l } = rgbToHsl(r, g, b);
  return l <= 0.08 || Math.max(r, g, b) <= 22 || relativeLuminance(r, g, b) <= 0.04;
}

export function cssRgb(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/** Clamp saturation/lightness so a cover color can sit under white text. */
export function clampForText(r: number, g: number, b: number): Rgb {
  let { h, s, l } = rgbToHsl(r, g, b);
  s = clamp(s, 0.42, 0.8);
  l = clamp(l, 0.2, 0.38);
  let rgb = hslToRgb(h, s, l);
  let guard = 0;
  while (
    contrastWithWhite(rgb.r, rgb.g, rgb.b) < 4.5 &&
    rgbToHsl(rgb.r, rgb.g, rgb.b).l > 0.14 &&
    guard < 16
  ) {
    l -= 0.02;
    rgb = hslToRgb(h, s, l);
    guard += 1;
  }
  return rgb;
}

export function paletteFromSamples(samples: Array<[number, number, number]>): CoverPalette | null {
  const chromatic: Array<Rgb & Hsl> = [];
  for (const [r, g, b] of samples) {
    if (isNearWhite(r, g, b) || isNearBlack(r, g, b)) continue;
    const hsl = rgbToHsl(r, g, b);
    if (hsl.s < 0.1) continue;
    chromatic.push({ r, g, b, ...hsl });
  }
  if (chromatic.length < Math.max(6, samples.length * 0.05)) return null;

  const buckets = new Map<number, Array<Rgb & Hsl>>();
  for (const pixel of chromatic) {
    const key = Math.round(pixel.h / 20) % 18;
    const list = buckets.get(key) ?? [];
    list.push(pixel);
    buckets.set(key, list);
  }
  const ranked = [...buckets.values()].sort((a, b) => b.length - a.length);
  const toCss = (group: Array<Rgb & Hsl>): string => {
    const n = group.length;
    const r = group.reduce((sum, p) => sum + p.r, 0) / n;
    const g = group.reduce((sum, p) => sum + p.g, 0) / n;
    const b = group.reduce((sum, p) => sum + p.b, 0) / n;
    const clamped = clampForText(r, g, b);
    return cssRgb(clamped.r, clamped.g, clamped.b);
  };

  const c1 = toCss(ranked[0]);
  if (ranked.length === 1) {
    const avg = ranked[0][0];
    const sibling = hslToRgb((avg.h + 18) % 360, avg.s, clamp(avg.l + 0.06, 0.16, 0.4));
    const shifted = clampForText(sibling.r, sibling.g, sibling.b);
    return { c1, c2: cssRgb(shifted.r, shifted.g, shifted.b) };
  }
  return { c1, c2: toCss(ranked[1]) };
}

export function paletteFromRgba(data: Uint8ClampedArray | Uint8Array): CoverPalette | null {
  const samples: Array<[number, number, number]> = [];
  const step = data.length >= 64 * 64 * 4 ? 16 : 4;
  for (let i = 0; i < data.length; i += step) {
    const alpha = data[i + 3] ?? 255;
    if (alpha < 128) continue;
    samples.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (samples.length === 0) return null;
  return paletteFromSamples(samples);
}

export function extractCoverPalette(
  image: CanvasImageSource & {
    naturalWidth?: number;
    width?: number;
    naturalHeight?: number;
    height?: number;
  },
): CoverPalette | null {
  const width = image.naturalWidth ?? image.width ?? 0;
  const height = image.naturalHeight ?? image.height ?? 0;
  if (!width || !height) return null;
  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, size, size);
  return paletteFromRgba(context.getImageData(0, 0, size, size).data);
}
