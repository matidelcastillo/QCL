import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerTypeHintALLOption,
} from "@capacitor/barcode-scanner";
import { Capacitor } from "@capacitor/core";
import { normalizeIsbn } from "../domain/isbn";
import { reportScan, type ScanDiagnostic } from "../data/scan-diag";

/* Every way the native scan can end. Only "isbn" opens a book; each other
   kind is shown to the user (see scanner.tsx), never swallowed. */
export type NativeScan =
  | { status: "isbn"; isbn: string }
  | { status: "cancelled" }
  | { status: "empty" }
  | { status: "invalid" }
  | { status: "denied" }
  | { status: "error" }
  | { status: "unavailable" };

const PLUGIN = "CapacitorBarcodeScanner";
const CANCELLED = "OS-PLUG-BARC-0006";
const DENIED = "OS-PLUG-BARC-0007";

function errorParts(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "";
  return { code, message };
}

/* The plugin rejects with OS-PLUG-BARC-*; older builds only had text. */
export function nativeScanFailure(error: unknown): "cancelled" | "denied" | "error" {
  const { code, message } = errorParts(error);
  if (code === CANCELLED || (!code && /cancel/i.test(message))) return "cancelled";
  if (code === DENIED || (!code && /camera access|permission/i.test(message))) return "denied";
  return "error";
}

/* What a resolved plugin value means. A missing or blank ScanResult is
   "empty", not "invalid": the camera closed without a code. */
export function nativeScanResult(value: unknown): NativeScan {
  const raw =
    value && typeof value === "object" && "ScanResult" in value ? value.ScanResult : undefined;
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return { status: "empty" };
  const isbn = normalizeIsbn(text);
  return isbn ? { status: "isbn", isbn } : { status: "invalid" };
}

export function nativeScanAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable(PLUGIN);
}

function diagnostic(
  result: NativeScan,
  value: unknown,
  error: unknown,
): Omit<ScanDiagnostic, "origin" | "app"> {
  const raw =
    value && typeof value === "object" && "ScanResult" in value ? value.ScanResult : undefined;
  const format = value && typeof value === "object" && "format" in value ? value.format : null;
  const { code, message } = error === undefined ? { code: "", message: "" } : errorParts(error);
  return {
    kind: result.status,
    format: typeof format === "number" || typeof format === "string" ? String(format) : null,
    length: typeof raw === "string" ? raw.trim().length : null,
    digits: typeof raw === "string" ? /^[\dXx\s-]+$/.test(raw.trim()) : null,
    errorCode: code || null,
    errorMessage: message || null,
    native: Capacitor.isNativePlatform(),
    plugin: Capacitor.isPluginAvailable(PLUGIN),
  };
}

/* Native shell without the plugin bridged: report it and let Scanner use
   the in-page camera instead of a scanner that can never answer. */
export async function nativeIsbnScannerAvailable() {
  if (!Capacitor.isNativePlatform()) return false;
  if (nativeScanAvailable()) return true;
  reportScan(diagnostic({ status: "unavailable" }, undefined, undefined));
  return false;
}

async function scanOnce(): Promise<NativeScan> {
  if (!nativeScanAvailable()) {
    const result: NativeScan = { status: "unavailable" };
    reportScan(diagnostic(result, undefined, undefined));
    return result;
  }
  try {
    const value: unknown = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHintALLOption.ALL,
    });
    const result = nativeScanResult(value);
    reportScan(diagnostic(result, value, undefined));
    return result;
  } catch (error) {
    const result: NativeScan = { status: nativeScanFailure(error) };
    reportScan(diagnostic(result, undefined, error));
    return result;
  }
}

/* The native scanner is a full-screen view over the WebView, so the page
   can re-render or even remount Escanear while it is open. The scan lives
   here, outside React: one scan at a time, and its outcome waits to be
   claimed by whichever Scanner is mounted when it arrives. */
const UNCLAIMED_MS = 30_000;
let inFlight: Promise<NativeScan> | null = null;
let unclaimed: { result: NativeScan; at: number } | null = null;

export function startNativeScan(now: () => number = Date.now): Promise<NativeScan> {
  inFlight ??= scanOnce().then((result) => {
    inFlight = null;
    unclaimed = { result, at: now() };
    return result;
  });
  return inFlight;
}

/* Takes the outcome that no mounted Scanner has handled yet. */
export function claimNativeScan(now: () => number = Date.now): NativeScan | null {
  const pending = unclaimed;
  unclaimed = null;
  return pending && now() - pending.at <= UNCLAIMED_MS ? pending.result : null;
}

export function hasUnclaimedNativeScan() {
  return unclaimed !== null;
}

export function nativeScanInFlight() {
  return inFlight !== null;
}

/* Leaving Escanear on purpose drops a late outcome. */
export function discardNativeScan() {
  unclaimed = null;
}
