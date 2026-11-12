import { useEffect, useId, useState } from "react";
import { BookCover } from "@/components/book-cover";
import { tapaSrc } from "@/lib/tapa";
import { StatusChoice } from "@/components/status-tabs";
import { todayIsoDate } from "@/lib/format";
import type { Book, BookStatus } from "@/lib/types";

export function BookSheet({
  book,
  busy,
  onClose,
  onSave,
  onRemove,
}: {
  book: Book;
  busy: boolean;
  onClose: () => void;
  onSave: (values: {
    title: string;
    author: string;
    status: BookStatus;
    read_at: string | null;
  }) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const titleId = useId();
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [status, setStatus] = useState<BookStatus>(book.status);
  const [readAt, setReadAt] = useState(book.read_at ?? todayIsoDate());

  useEffect(() => {
    setTitle(book.title);
    setAuthor(book.author);
    setStatus(book.status);
    setReadAt(book.read_at ?? todayIsoDate());
  }, [book]);

  function changeStatus(next: BookStatus) {
    setStatus(next);
    if (next === "lei" && !readAt) setReadAt(todayIsoDate());
  }

  async function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || busy) return;
    await onSave({
      title: trimmedTitle,
      author: author.trim(),
      status,
      read_at: status === "lei" ? readAt || todayIsoDate() : null,
    });
  }

  return (
    <div className="qcl-sheet-backdrop" onClick={onClose}>
      <div
        className="drawer-surface qcl-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="qcl-sheet-handle" aria-hidden="true" />
        {book.cover_url ? (
          <div className="qcl-sheet-cover">
            <BookCover url={tapaSrc(book.cover_url, book.isbn)} title={book.title} />
          </div>
        ) : null}
        <div className="qcl-sheet-top">
          <h2 id={titleId} className="drawer-title qcl-sheet-title">
            Libro
          </h2>
          <button
            type="button"
            className="drawer-close-flat qcba-icon-btn qcl-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            Cerrar
          </button>
        </div>

        <label className="qcl-field">
          <span>Título</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="qcl-field">
          <span>Autor</span>
          <input
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            autoComplete="off"
          />
        </label>

        <div className="qcl-field">
          <span>Estado</span>
          <StatusChoice value={status} onChange={changeStatus} />
        </div>

        {status === "lei" ? (
          <label className="qcl-field">
            <span>Fecha</span>
            <input type="date" value={readAt} onChange={(event) => setReadAt(event.target.value)} />
          </label>
        ) : null}

        <div className="qcl-sheet-actions">
          <button
            type="button"
            className="qcl-secondary-btn"
            disabled={busy}
            onClick={() => void onRemove()}
          >
            Sacar
          </button>
          <button
            type="button"
            className="qcl-primary-btn"
            disabled={busy || !title.trim()}
            onClick={() => void handleSave()}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
