import type { CSSProperties } from "react";
import { BookCover } from "@/components/book-cover";
import { formatMonthYear, statusLabel } from "@/lib/format";
import { tapaSrc } from "@/lib/tapa";
import { useCoverPalette } from "@/lib/use-cover-palette";
import type { Book } from "@/lib/types";

export function BookCard({ book, onSelect }: { book: Book; onSelect: (book: Book) => void }) {
  const src = tapaSrc(book.cover_url, book.isbn);
  const palette = useCoverPalette(src);

  return (
    <button
      type="button"
      className={`qc-press-card qcl-book-card qcl-book-card-${book.status}`}
      style={
        {
          background: `linear-gradient(135deg, ${palette.c1} 0%, ${palette.c2} 100%)`,
        } as CSSProperties
      }
      onClick={() => onSelect(book)}
    >
      <BookCover url={src} title={book.title} />
      <span className="qcl-book-copy">
        <span className="qcl-book-title">{book.title}</span>
        {book.author ? <span className="qcl-book-author">{book.author}</span> : null}
        <span className="qcl-book-foot">
          <span className={`qcl-badge qcl-badge-${book.status}`}>{statusLabel(book.status)}</span>
          {book.status === "lei" && book.read_at ? (
            <span className="qcl-book-date">{formatMonthYear(book.read_at)}</span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
