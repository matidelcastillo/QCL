/* TEMPORARY (2026-11-18), see docs/DECISIONS.md: POST /api/diag logs how a
   native scan ended, to debug the scanner on a real iPhone. Remove it once
   the cause is confirmed. Whitelisted fields only, nothing that names a
   person or a book: no code, no ISBN, no user id, no token, no IP. */
export const DIAG_MAX_BYTES = 1_024;

const KINDS = new Set(["isbn", "cancelled", "empty", "invalid", "denied", "error", "unavailable"]);
const ORIGINS = new Set(["https://qcl.matidelcastillo.workers.dev", "capacitor://localhost"]);

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  /* Long digit runs could be a scanned code; keep only the shape. */
  const clean = value
    .replace(/\d{5,}/g, "#")
    .replace(/\s+/g, " ")
    .trim();
  return clean ? clean.slice(0, max) : null;
}

export type ScanDiag = {
  kind: string;
  format: string | null;
  length: number | null;
  digits: boolean | null;
  errorCode: string | null;
  errorMessage: string | null;
  native: boolean | null;
  plugin: boolean | null;
  origin: string;
  app: string | null;
};

export function parseScanDiag(body: unknown): ScanDiag | null {
  if (!body || typeof body !== "object") return null;
  const entry = body as Record<string, unknown>;
  if (typeof entry.kind !== "string" || !KINDS.has(entry.kind)) return null;
  const flag = (value: unknown) => (typeof value === "boolean" ? value : null);
  const length =
    typeof entry.length === "number" && Number.isInteger(entry.length) && entry.length >= 0
      ? Math.min(entry.length, 999)
      : null;
  return {
    kind: entry.kind,
    format: text(entry.format, 24),
    length,
    digits: flag(entry.digits),
    errorCode: text(entry.errorCode, 32),
    errorMessage: text(entry.errorMessage, 160),
    native: flag(entry.native),
    plugin: flag(entry.plugin),
    origin: typeof entry.origin === "string" && ORIGINS.has(entry.origin) ? entry.origin : "other",
    app: text(entry.app, 24),
  };
}
