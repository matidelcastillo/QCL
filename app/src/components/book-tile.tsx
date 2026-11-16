import type { CSSProperties } from "react";
import type { Book } from "../domain/types";
import { BookCover } from "./book-cover";

/* Grid tile: the cover alone, 2:3, as a QC media card (compact shadow, press
   scale, staggered entrance; routes/index.tsx l. 2235-2380). */
export function BookTile({
  book,
  index,
  onOpen,
}: {
  book: Book;
  index: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="book-tile media-card-treatment-compact qc-press-card card-enter"
      style={{ "--i": index } as CSSProperties}
      aria-label={`Ver ${book.title}`}
      onClick={onOpen}
    >
      <BookCover url={book.cover_url} isbn={book.isbn} size="tile" />
    </button>
  );
}
