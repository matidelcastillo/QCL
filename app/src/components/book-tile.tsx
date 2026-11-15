import { Check, Heart } from "lucide-react";
import type { CSSProperties } from "react";
import type { Book } from "../domain/types";
import { BookCover } from "./book-cover";

/* Grid tile = QC events grid card (routes/index.tsx l. 2235-2380): rounded
   media card with compact shadow, image wash, two-line title over the image,
   circled marker top right and staggered entrance. The tile keeps the 2:3
   cover ratio instead of QC's square photo so covers are not cropped. */
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
      <span className="media-card-surface" aria-hidden="true" />
      <span className="book-tile-status" aria-label={book.status === "quiero" ? "Quiero" : "Leí"}>
        {book.status === "quiero" ? (
          <Heart strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
        ) : (
          <Check strokeWidth={1.6} aria-hidden="true" />
        )}
      </span>
      <span className="book-tile-title">{book.title}</span>
    </button>
  );
}
