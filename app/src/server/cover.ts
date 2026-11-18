/* Accepted cover sources: Open Library and Google Books first, then the
   ISBN image paths of Casa del Libro (Spanish editions) and Amazon. */
const hosts = new Set([
  "covers.openlibrary.org",
  "books.google.com",
  "books.googleusercontent.com",
  "imagessl.casadellibro.com",
  "m.media-amazon.com",
]);
/* Open Library serves every cover through a redirect to its Internet Archive
   storage (archive.org, then ia<N>.us.archive.org); only those hops are added. */
const redirectHosts = /^(archive\.org|ia\d+\.us\.archive\.org)$/;
/* Google Books generic "image not available" covers: SHA-256 of the bytes
   observed at zoom 0–3, plus a later generic PNG for other missing ISBNs. */
const placeholderHashes = new Set([
  "729486963874f66935b0a01ee5271e9dead375f60f22c56db05b0e9bfac0cbb8",
  "2391e84fe8ea8a1f0c8f5e4f35098aaa71fee54eccba1ecfe45adc85439e7ce7",
  "78cb76768db9a199e7d70e84fa80edccdd27e1e68453062f718e3ba3282b9fef",
  "194a59e32e67af04934666e43823aadecfff17cc04ca9eb70486bf0eb0475a09",
  "3efa8c43e5b4348f303a528c81adf435f0111ea752fe9f0f6241478b60987fa6",
]);
export const MAX_COVER_BYTES = 2_000_000;
/* 3 hops cover the original request plus the two Open Library redirects
   (archive.org → iaN.us.archive.org). */
export const COVER_FETCH_HOPS = 3;

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeUrl(raw: string, allowed: (host: string) => boolean): URL | null {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" &&
      !url.port &&
      !url.username &&
      !url.password &&
      allowed(url.hostname)
      ? url
      : null;
  } catch {
    return null;
  }
}

export function allowedCoverUrl(raw: string): URL | null {
  return safeUrl(raw, (host) => hosts.has(host));
}

function allowedRedirect(raw: string): URL | null {
  return safeUrl(raw, (host) => hosts.has(host) || redirectHosts.test(host));
}

function dimensions(bytes: Uint8Array, type: string): { width: number; height: number } | null {
  if (type === "image/png") {
    if (bytes.length < 24 || ![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
      return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (type !== "image/jpeg" || bytes[0] !== 255 || bytes[1] !== 216) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 255) {
      i++;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2 || i + length + 2 > bytes.length) return null;
    if (
      [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
        marker,
      )
    ) {
      return {
        height: (bytes[i + 5] << 8) | bytes[i + 6],
        width: (bytes[i + 7] << 8) | bytes[i + 8],
      };
    }
    i += length + 2;
  }
  return null;
}

export async function validCover(bytes: Uint8Array, type: string): Promise<boolean> {
  if (bytes.byteLength < 2048 || bytes.byteLength > MAX_COVER_BYTES) return false;
  if (type !== "image/jpeg" && type !== "image/png") return false;
  const size = dimensions(bytes, type);
  if (!size || size.width < 100) return false;
  if (type === "image/png" && size.width === 300 && size.height === 391) return false;
  if (placeholderHashes.has(await sha256(bytes))) return false;
  return true;
}

/* Read a cover body up to MAX_COVER_BYTES. Abort if Content-Length or the
   streamed body goes past the cap, including when the length header is missing. */
export async function readBody(
  source: Request | Response,
  maxBytes = MAX_COVER_BYTES,
): Promise<Uint8Array | null> {
  const length = Number(source.headers.get("content-length"));
  if (Number.isFinite(length) && length > maxBytes) return null;
  const body = source.body;
  if (!body) {
    const bytes = new Uint8Array(await source.arrayBuffer());
    return bytes.byteLength > maxBytes ? null : bytes;
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function fetchCover(
  url: URL,
): Promise<{ bytes: Uint8Array; type: string; sourceUrl: string } | null> {
  let current = url;
  for (let hop = 0; hop < COVER_FETCH_HOPS; hop++) {
    let response: Response;
    try {
      response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(8000) });
    } catch {
      return null;
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      const next = location && allowedRedirect(new URL(location, current).toString());
      if (!next) return null;
      current = next;
      continue;
    }
    if (!response.ok) return null;
    const type = (response.headers.get("content-type") ?? "").split(";")[0].trim();
    const bytes = await readBody(response);
    return bytes && (await validCover(bytes, type))
      ? { bytes, type, sourceUrl: url.toString() }
      : null;
  }
  return null;
}

/* True when the URL is allowlisted and fetchCover gets a real image,
   not a 404 or a known placeholder. */
export async function coverResolves(raw: string | null | undefined): Promise<boolean> {
  const url = raw ? allowedCoverUrl(raw) : null;
  return Boolean(url && (await fetchCover(url)));
}
