const hosts = new Set([
  "covers.openlibrary.org",
  "books.google.com",
  "books.googleusercontent.com",
]);
/* Google Books generic "image not available" bytes observed at zoom 0–3. */
const placeholderHashes = new Set(["c84d8baf", "5c4ccddd", "6a075bb7", "f231d268", "b67b4c6d"]);

function fnv1a(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function allowedCoverUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" &&
      !url.port &&
      hosts.has(url.hostname) &&
      !url.username &&
      !url.password
      ? url
      : null;
  } catch {
    return null;
  }
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

export function validCover(bytes: Uint8Array, type: string): boolean {
  if (bytes.byteLength < 2048 || bytes.byteLength > 2_000_000) return false;
  if (type !== "image/jpeg" && type !== "image/png") return false;
  const size = dimensions(bytes, type);
  if (!size || size.width < 100) return false;
  if (type === "image/png" && size.width === 300 && size.height === 391) return false;
  if (placeholderHashes.has(fnv1a(bytes))) return false;
  return true;
}

export async function fetchCover(
  url: URL,
): Promise<{ bytes: Uint8Array; type: string; sourceUrl: string } | null> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    let response: Response;
    try {
      response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(8000) });
    } catch {
      return null;
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      const next = location && allowedCoverUrl(new URL(location, current).toString());
      if (!next) return null;
      current = next;
      continue;
    }
    if (!response.ok) return null;
    const length = Number(response.headers.get("content-length"));
    if (length > 2_000_000) return null;
    const type = (response.headers.get("content-type") ?? "").split(";")[0].trim();
    const bytes = new Uint8Array(await response.arrayBuffer());
    return validCover(bytes, type) ? { bytes, type, sourceUrl: current.toString() } : null;
  }
  return null;
}
