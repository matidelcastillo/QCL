import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Heart, X } from "lucide-react";
import type { Book, BookStatus, CatalogBook, ManualBook, SharedBook } from "../domain/types";
import { today } from "../domain/date";
import { knownGenre } from "../domain/genre";
import {
  duplicate,
  ensureBook,
  pendingBook,
  removeBook,
  setBookStatus,
  toNewBook,
} from "../data/library";
import { useBooks } from "../data/use-books";
import { useSession } from "../data/session-context";
import { sessionEpoch } from "../data/session-epoch";
import { BookCover } from "./book-cover";
import { Sheet } from "./sheet";

/* Book sheet = QC event drawer (routes/index.tsx l. 2690-3010): handle,
   hero, .drawer-title, .drawer-meta, .drawer-action-dock (no synopsis shown).
   Dock: Quiero, Leí and, for a saved book, Quitar (confirmed in a
   .drawer-choice-dock below).
   The 16:9 photo hero becomes a centered 2:3 cover (benchmark: Goodreads /
   StoryGraph book page). */
export function BookSheet({
  book,
  onClose,
}: {
  book: Book | CatalogBook | ManualBook | SharedBook;
  onClose: () => void;
}) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const queryKey = ["books", user?.id];
  const { data: books = [] } = useBooks(user?.id);
  const saved = "id" in book ? books.find((item) => item.id === book.id) : duplicate(books, book);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [popped, setPopped] = useState<BookStatus | null>(null);
  const cover = "cover_url" in book ? book.cover_url : book.coverUrl;
  /* A catalog result has no genre until it is saved and classified. */
  const genre = knownGenre(saved?.genre ?? ("genre" in book ? book.genre : null));

  async function choose(status: BookStatus) {
    if (!user || busy || saved?.status === status) return;
    const epoch = sessionEpoch();
    const previous = queryClient.getQueryData<Book[]>(queryKey) ?? books;
    setBusy(true);
    setError("");
    setPopped(status);
    queryClient.setQueryData<Book[]>(
      queryKey,
      saved
        ? previous.map((item) =>
            item.id === saved.id
              ? { ...item, status, read_at: status === "lei" ? today() : null }
              : item,
          )
        : [pendingBook(user.id, toNewBook(book), status), ...previous],
    );
    try {
      if (saved) await setBookStatus(user.id, saved.id, status);
      else await ensureBook(user.id, toNewBook(book), status);
    } catch {
      if (epoch === sessionEpoch()) {
        queryClient.setQueryData(queryKey, previous);
        setError("No pudimos guardar.");
      }
    } finally {
      if (epoch === sessionEpoch()) await queryClient.invalidateQueries({ queryKey });
      setBusy(false);
    }
  }

  async function remove() {
    if (!user || !saved || busy) return;
    const epoch = sessionEpoch();
    const previous = queryClient.getQueryData<Book[]>(queryKey) ?? books;
    setBusy(true);
    setError("");
    try {
      await removeBook(user.id, saved.id);
      if (epoch !== sessionEpoch()) return;
      queryClient.setQueryData<Book[]>(
        queryKey,
        previous.filter((item) => item.id !== saved.id),
      );
      onClose();
      await queryClient.invalidateQueries({ queryKey });
    } catch {
      if (epoch === sessionEpoch()) {
        setError("No pudimos quitar.");
        setBusy(false);
      }
    }
  }

  return (
    <Sheet onClose={onClose} label={book.title}>
      <div className="drawer-body drawer-body-enter drawer-centered">
        <div className="drawer-hero-book">
          <BookCover url={cover} isbn={book.isbn} size="large" />
        </div>
        <h2 className="drawer-title">{book.title}</h2>
        {(book.author || genre) && (
          <div className="drawer-meta">
            {book.author && <span>{book.author}</span>}
            {book.author && genre && <span className="drawer-meta-separator"> · </span>}
            {genre && <span>{genre}</span>}
          </div>
        )}
        <div className="drawer-action-dock">
          <button
            type="button"
            className="drawer-action"
            aria-label="Leí"
            aria-pressed={saved?.status === "lei"}
            onClick={() => void choose("lei")}
          >
            <Check
              className={`drawer-action-icon${popped === "lei" ? " heart-pop" : ""}`}
              strokeWidth={2}
              onAnimationEnd={() => setPopped(null)}
              aria-hidden="true"
            />
            <span className="drawer-action-label">LEÍ</span>
          </button>
          <button
            type="button"
            className="drawer-action"
            aria-label="Quiero"
            aria-pressed={saved?.status === "quiero"}
            onClick={() => void choose("quiero")}
          >
            <Heart
              className={`drawer-action-icon${popped === "quiero" ? " heart-pop" : ""}`}
              strokeWidth={2}
              fill={saved?.status === "quiero" ? "currentColor" : "none"}
              onAnimationEnd={() => setPopped(null)}
              aria-hidden="true"
            />
            <span className="drawer-action-label">QUIERO</span>
          </button>
          {saved && (
            <button
              type="button"
              className="drawer-action"
              aria-label="Quitar"
              aria-pressed={confirming}
              onClick={() => setConfirming(true)}
            >
              <X className="drawer-action-icon" strokeWidth={2} aria-hidden="true" />
              <span className="drawer-action-label">QUITAR</span>
            </button>
          )}
        </div>
        {saved && confirming && (
          <div className="drawer-choice-dock">
            <button type="button" className="drawer-choice" onClick={() => setConfirming(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="drawer-choice drawer-choice-active"
              disabled={busy}
              onClick={() => void remove()}
            >
              Quitar
            </button>
          </div>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
