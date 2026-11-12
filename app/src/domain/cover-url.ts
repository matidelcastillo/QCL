import { normalizeIsbn } from "./isbn";

export function coverCandidate(
  url: string | null | undefined,
  isbn: string | null | undefined,
): string | null {
  if (url) return url;
  const normalized = normalizeIsbn(isbn ?? "");
  return normalized
    ? `https://books.google.com/books/content?vid=ISBN${normalized}&printsec=frontcover&img=1&zoom=1`
    : null;
}
