import { normalizeIsbn } from "@/lib/isbn";

export function isBlockedTapaHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "0.0.0.0"
  ) {
    return true;
  }
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    const [a, b] = host.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  if (host.includes(":")) {
    if (
      host === "::1" ||
      host === "::" ||
      host.startsWith("fe80:") ||
      host.startsWith("fc") ||
      host.startsWith("fd")
    ) {
      return true;
    }
  }
  return false;
}

export function isAllowedTapaUrl(raw: string): URL | null {
  if (!raw || raw.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (isBlockedTapaHost(url.hostname)) return null;
  return url;
}

/** Fast, direct JPEGs from Google Books (zoom 2 then 1). Missing titles return PNG stubs. */
export function googleIsbnCoverUrls(isbn: string): string[] {
  const normalized = normalizeIsbn(isbn);
  if (!normalized) return [];
  return [2, 1].map(
    (zoom) =>
      `https://books.google.com/books/content?vid=ISBN${normalized}&printsec=frontcover&img=1&zoom=${zoom}`,
  );
}

export function googleIsbnCoverUrl(isbn: string): string | null {
  return googleIsbnCoverUrls(isbn)[0] ?? null;
}

/** Recurring Google Books grey "no cover" JPEG (10794 bytes). */
const GOOGLE_JPEG_STUB_FNV = new Set(["b67b4c6d"]);

function fnv1aHex(bytes: ArrayBuffer): string {
  let hash = 0x811c9dc5;
  for (const value of new Uint8Array(bytes)) {
    hash ^= value;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Read an ISBN out of an Open Library cover path like /b/isbn/978...-L.jpg */
export function isbnFromCoverUrl(raw: string | URL): string | null {
  const value = typeof raw === "string" ? raw : raw.pathname;
  const match = value.match(/\/b\/isbn\/(\d{10,13})(?:-[A-Za-z])?/i);
  return match ? normalizeIsbn(match[1]) : null;
}

export function resolveTapaIsbn(
  url: string | URL | null | undefined,
  isbn?: string | null,
): string | null {
  return normalizeIsbn(isbn) ?? (url ? isbnFromCoverUrl(url) : null);
}

export function isUsableCoverPayload(
  type: string,
  bytes: ArrayBuffer,
  kind: "google" | "any" = "any",
): boolean {
  if (bytes.byteLength < 2000 || bytes.byteLength > 2_000_000) return false;
  if (!type.startsWith("image/")) return false;
  const header = new Uint8Array(bytes.slice(0, 3));
  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  if (!isJpeg) {
    // Google "image not available" placeholders are PNG, including a 9KB one.
    if (kind === "google") return false;
    const isPng = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e;
    return isPng && bytes.byteLength >= 4000;
  }
  if (kind === "google" && GOOGLE_JPEG_STUB_FNV.has(fnv1aHex(bytes))) return false;
  return true;
}

/** Same-origin proxy so canvas can sample cover pixels without CORS taint. */
export function tapaSrc(
  url: string | null | undefined,
  isbn?: string | null,
): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:image/")) return trimmed;
  if (trimmed.startsWith("/api/tapa?")) return trimmed;
  if (!isAllowedTapaUrl(trimmed)) return null;
  const params = new URLSearchParams({ u: trimmed });
  const resolved = resolveTapaIsbn(trimmed, isbn);
  if (resolved) params.set("isbn", resolved);
  return `/api/tapa?${params}`;
}
