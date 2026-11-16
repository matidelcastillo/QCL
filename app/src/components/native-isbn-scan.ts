import { Capacitor } from "@capacitor/core";
import { BarcodeFormat, BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";
import { normalizeIsbn } from "../domain/isbn";

const ISBN_FORMATS = [
  BarcodeFormat.Ean13,
  BarcodeFormat.Ean8,
  BarcodeFormat.UpcA,
  BarcodeFormat.UpcE,
];

export async function nativeIsbnScannerAvailable() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { supported } = await BarcodeScanner.isSupported();
    return supported;
  } catch {
    return false;
  }
}

export async function scanIsbnNative(): Promise<string | null> {
  const permission = await BarcodeScanner.requestPermissions();
  if (permission.camera !== "granted") return null;
  const { barcodes } = await BarcodeScanner.scan({ formats: ISBN_FORMATS });
  for (const barcode of barcodes) {
    const isbn = normalizeIsbn(barcode.rawValue ?? barcode.displayValue);
    if (isbn) return isbn;
  }
  return null;
}

export async function stopNativeScan() {
  try {
    await BarcodeScanner.stopScan();
  } catch {
    /* Already stopped, or the one-shot scan() UI was used. */
  }
}
