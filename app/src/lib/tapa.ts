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

/** Same-origin proxy so canvas can sample cover pixels without CORS taint. */
export function tapaSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:image/")) return trimmed;
  if (trimmed.startsWith("/api/tapa?")) return trimmed;
  if (!isAllowedTapaUrl(trimmed)) return null;
  return `/api/tapa?u=${encodeURIComponent(trimmed)}`;
}
