/* /api/tapa query: the stored cover if any, plus the ISBN so the server can
   look the edition up elsewhere. */
export function coverParams(
  url: string | null | undefined,
  isbn: string | null | undefined,
): URLSearchParams {
  const params = new URLSearchParams();
  if (url) params.set("u", url);
  if (isbn) params.set("isbn", isbn);
  return params;
}
