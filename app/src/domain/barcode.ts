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

export type BarcodeRead = { kind: "isbn"; isbn: string } | { kind: "invalid" } | { kind: "none" };

export function barcodeFromResults(results: ReadResult[]): BarcodeRead {
  let invalid = false;
  for (const result of results) {
    if (!result.isValid) continue;
    const isbn = normalizeIsbn(result.text);
    if (isbn) return { kind: "isbn", isbn };
    invalid = true;
  }
  return invalid ? { kind: "invalid" } : { kind: "none" };
}

export function isbnFromResults(results: ReadResult[]): string | null {
  const read = barcodeFromResults(results);
  return read.kind === "isbn" ? read.isbn : null;
}
