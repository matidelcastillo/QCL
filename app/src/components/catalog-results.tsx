import { BookCover } from "@/components/book-cover";
import type { BookStatus, CatalogBook } from "@/lib/types";

export function CatalogResults({
  books,
  busyId,
  onAdd,
}: {
  books: CatalogBook[];
  busyId: string | null;
  onAdd: (book: CatalogBook, status: BookStatus) => void;
}) {
  if (books.length === 0) return null;
  return (
    <ul className="qcl-catalog-list">
      {books.map((book) => {
        const id = book.externalId;
        const busy = busyId === id;
        return (
          <li key={id} className="qcl-catalog-item">
            <BookCover url={book.coverUrl} title={book.title} />
            <div className="qcl-catalog-body">
              <p className="qcl-book-title">{book.title}</p>
              {book.author ? <p className="qcl-book-author">{book.author}</p> : null}
              {book.year ? <p className="qcl-book-meta">{book.year}</p> : null}
              <div className="qcl-catalog-actions">
                <button
                  type="button"
                  className="qcl-mini-btn"
                  disabled={busy}
                  onClick={() => onAdd(book, "quiero")}
                >
                  Quiero
                </button>
                <button
                  type="button"
                  className="qcl-mini-btn qcl-mini-btn-orange"
                  disabled={busy}
                  onClick={() => onAdd(book, "lei")}
                >
                  Leí
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
