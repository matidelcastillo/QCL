/* Swap a result whose cover missed for the next backup. The grid stays
   at six cards and never invents a book; if the pool is empty, the
   caller keeps the current row. */
export function swapFailedCover<T extends { id: string }>(
  shown: T[],
  backups: T[],
  failedId: string,
): { shown: T[]; backups: T[] } {
  const index = shown.findIndex((book) => book.id === failedId);
  if (index < 0) return { shown, backups };
  const seen = new Set(shown.map((book) => book.id));
  const nextIndex = backups.findIndex((book) => !seen.has(book.id));
  if (nextIndex < 0) return { shown, backups };
  const next = backups[nextIndex]!;
  return {
    shown: shown.map((book, i) => (i === index ? next : book)),
    backups: backups.filter((_, i) => i !== nextIndex),
  };
}
