import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerTypeHintALLOption,
} from "@capacitor/barcode-scanner";
import { Capacitor } from "@capacitor/core";
import { normalizeIsbn } from "../domain/isbn";

export async function nativeIsbnScannerAvailable() {
  return Capacitor.isNativePlatform();
}

export async function scanIsbnNative(): Promise<string | null> {
  try {
    const { ScanResult } = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHintALLOption.ALL,
    });
    return normalizeIsbn(ScanResult);
  } catch {
    return null;
  }
}

export async function stopNativeScan() {
  /* The official plugin scan is one-shot and has no stop API. */
}
