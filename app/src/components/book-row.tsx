import { Check, Heart } from "lucide-react";
import type { Book, CatalogBook } from "../domain/types";
import { BookCover } from "./book-cover";

/* Row = QC .qc-people-row (editorial row, no card). Cover left, copy right,
   status indicator right (benchmark: StoryGraph / Literal library lists). */
export function BookRow({
  book,
  saved,
  onOpen,
}: {
  book: Book | CatalogBook;
  saved?: Book;
  onOpen: () => void;
}) {
  const stored = saved ?? ("id" in book ? book : undefined);
  const cover = "cover_url" in book ? book.cover_url : book.coverUrl;
  const meta = [book.page_count ? `${book.page_count} pág.` : null, book.published_year].filter(
    (part): part is string => Boolean(part),
  );
  return (
    <button type="button" className="qc-people-row qc-press-card" onClick={onOpen}>
      <BookCover url={cover} isbn={book.isbn} />
      <span className="row-copy">
        <span className="row-title">{book.title}</span>
        {book.author && <span className="row-author">{book.author}</span>}
        {meta.length > 0 && (
          <span className="row-meta">
            {meta.map((part, index) => (
              <span key={part}>
                {index > 0 && <span className="row-separator"> · </span>}
                {part}
              </span>
            ))}
          </span>
        )}
        {book.genre && <span className="row-meta">{book.genre}</span>}
      </span>
      {stored && (
        <span className="row-status" aria-label={stored.status === "quiero" ? "Quiero" : "Leí"}>
          {stored.status === "quiero" ? (
            <Heart size={24} strokeWidth={2} fill="currentColor" aria-hidden="true" />
          ) : (
            <Check size={24} strokeWidth={2} aria-hidden="true" />
          )}
        </span>
      )}
    </button>
  );
}
