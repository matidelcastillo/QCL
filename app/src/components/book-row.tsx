import { Check, Heart } from "lucide-react";
import type { Book, CatalogBook } from "../domain/types";
import { BookCover } from "./book-cover";

export function BookRow({
  book,
  saved,
  onClick,
}: {
  book: Book | CatalogBook;
  saved?: Book;
  onClick: () => void;
}) {
  const stored = saved ?? ("id" in book ? book : undefined);
  const cover = "cover_url" in book ? book.cover_url : book.coverUrl;
  const pieces = [book.page_count ? `${book.page_count} pág.` : null, book.published_year].filter(
    Boolean,
  );
  return (
    <button
      type="button"
      className="qc-people-row qc-press-card"
      onClick={onClick}
      aria-label={`Abrir ${book.title}`}
    >
      <BookCover url={cover} isbn={book.isbn} />
      <span className="row-copy">
        <span className="row-title">{book.title}</span>
        {book.author && <span className="row-author">{book.author}</span>}
        {pieces.length > 0 && <span className="row-meta">{pieces.join(" · ")}</span>}
        {book.genre && <span className="row-meta">{book.genre}</span>}
      </span>
      {stored && (
        <span className="row-status" aria-hidden="true">
          {stored.status === "quiero" ? (
            <Heart size={24} strokeWidth={2} fill="currentColor" />
          ) : (
            <Check size={24} strokeWidth={2} />
          )}
        </span>
      )}
    </button>
  );
}
