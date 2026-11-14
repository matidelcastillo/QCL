import type { ReaderOptions, ReadResult } from "zxing-wasm/reader";
import { normalizeIsbn } from "./isbn";

/* Book barcodes are EAN-13 (978 / 979). tryHarder + tryDownscale keep
   slightly blurred or small codes readable. */
export const ISBN_READER_OPTIONS: ReaderOptions = {
  formats: ["EAN13"],
  tryHarder: true,
  tryRotate: true,
  tryDownscale: true,
  maxNumberOfSymbols: 4,
};

export function isbnFromResults(results: ReadResult[]): string | null {
  for (const result of results) {
    const isbn = result.isValid ? normalizeIsbn(result.text) : null;
    if (isbn) return isbn;
  }
  return null;
}
