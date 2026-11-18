const ALLOWED = [
  "mercadolibre.com.ar",
  "books.google.com",
  "books.google.com.ar",
  "play.google.com",
];

export function allowedExternalUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    return ALLOWED.some((base) => host === base || host.endsWith(`.${base}`)) ? url : null;
  } catch {
    return null;
  }
}

export function mercadoLibreSearch(isbn: string): string {
  return `https://listado.mercadolibre.com.ar/${encodeURIComponent(isbn)}`;
}

export function buyUrl(
  buyLink: string | null | undefined,
  isbn: string | null | undefined,
): URL | null {
  if (buyLink) {
    const url = allowedExternalUrl(buyLink);
    if (url) return url;
  }
  return isbn ? allowedExternalUrl(mercadoLibreSearch(isbn)) : null;
}

export function openExternal(raw: string) {
  const url = allowedExternalUrl(raw);
  if (!url || typeof window === "undefined") return;
  window.open(url.toString(), "_blank", "noopener,noreferrer");
}
