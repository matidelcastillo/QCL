import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerTypeHintALLOption,
} from "@capacitor/barcode-scanner";
import { Capacitor } from "@capacitor/core";
import { normalizeIsbn } from "../domain/isbn";

export type NativeScan =
  | { status: "isbn"; isbn: string }
  | { status: "cancelled" }
  | { status: "invalid" }
  | { status: "denied" }
  | { status: "unavailable" };

const CANCELLED = "OS-PLUG-BARC-0006";
const DENIED = "OS-PLUG-BARC-0007";

export function nativeScanFailure(error: unknown): "cancelled" | "denied" | "unavailable" {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "";
  if (code === CANCELLED || /cancel/i.test(message)) return "cancelled";
  if (code === DENIED || /camera access|permission/i.test(message)) return "denied";
  return "unavailable";
}

export async function nativeIsbnScannerAvailable() {
  return Capacitor.isNativePlatform();
}

export async function scanIsbnNative(): Promise<NativeScan> {
  try {
    const { ScanResult } = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHintALLOption.ALL,
    });
    const isbn = normalizeIsbn(ScanResult);
    return isbn ? { status: "isbn", isbn } : { status: "invalid" };
  } catch (error) {
    return { status: nativeScanFailure(error) };
  }
}

export async function stopNativeScan() {
  /* The official plugin scan is one-shot and has no stop API. */
}
