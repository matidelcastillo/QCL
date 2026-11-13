import type { SharedBook } from "../domain/types";
import { sharedCounts } from "../data/shared-books";
import { BookCover } from "./book-cover";

/* Same QC .qc-people-row as BookRow (cover, title, author, .row-meta with
   " · " separators); the meta line carries the counts instead of page data. */
export function SharedBookRow({ book, onOpen }: { book: SharedBook; onOpen: () => void }) {
  const counts = sharedCounts(book);
  return (
    <button type="button" className="qc-people-row qc-press-card" onClick={onOpen}>
      <BookCover url={book.coverUrl} isbn={book.isbn} />
      <span className="row-copy">
        <span className="row-title">{book.title}</span>
        {book.author && <span className="row-author">{book.author}</span>}
        <span className="row-meta">
          {counts.map((part, index) => (
            <span key={part}>
              {index > 0 && <span className="row-separator"> · </span>}
              {part}
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}
