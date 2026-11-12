import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Heart, Share2 } from "lucide-react";
import type { Book, BookStatus, CatalogBook } from "../domain/types";
import { duplicate, ensureBook, removeBook, setBookStatus } from "../data/library";
import { useBooks } from "../data/use-books";
import { useSession } from "../data/session-context";
import { sessionEpoch } from "../data/session-epoch";
import { BookCover } from "./book-cover";
import { Sheet } from "./sheet";

export function BookSheet({ book, onClose }: { book: Book | CatalogBook; onClose: () => void }) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const queryKey = ["books", user?.id];
  const { data: books = [] } = useBooks(user?.id);
  const saved = useMemo(
    () =>
      "id" in book ? (books.find((item) => item.id === book.id) ?? book) : duplicate(books, book),
    [book, books],
  );
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [popped, setPopped] = useState<BookStatus | null>(null);
  const cover = "cover_url" in book ? book.cover_url : book.coverUrl;

  async function choose(status: BookStatus) {
    if (!user || busy || saved?.status === status) return;
    const previous = queryClient.getQueryData<Book[]>(queryKey) ?? books;
    const epoch = sessionEpoch();
    await queryClient.cancelQueries({ queryKey });
    if (epoch !== sessionEpoch()) return;
    setBusy(true);
    setError("");
    setPopped(status);
    const optimistic: Book = saved
      ? {
          ...saved,
          status,
          read_at: status === "lei" ? new Date().toISOString().slice(0, 10) : null,
        }
      : {
          id: `pending-${Date.now()}`,
          owner_id: user.id,
          title: book.title,
          author: book.author,
          status,
          read_at: status === "lei" ? new Date().toISOString().slice(0, 10) : null,
          cover_url: cover ?? null,
          isbn: book.isbn,
          source: book.source,
          external_id: "externalId" in book ? book.externalId : book.external_id,
          page_count: book.page_count,
          published_year: book.published_year,
          genre: book.genre,
          synopsis: book.synopsis,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
    queryClient.setQueryData<Book[]>(
      queryKey,
      saved
        ? previous.map((item) => (item.id === saved.id ? optimistic : item))
        : [optimistic, ...previous],
    );
    try {
      const result =
        saved && !saved.id.startsWith("pending-")
          ? await setBookStatus(user.id, saved.id, status)
          : await ensureBook(
              user.id,
              {
                title: book.title,
                author: book.author,
                isbn: book.isbn,
                coverUrl: cover,
                source: book.source,
                externalId: "externalId" in book ? book.externalId : book.external_id,
                page_count: book.page_count,
                published_year: book.published_year,
                genre: book.genre,
                synopsis: book.synopsis,
              },
              status,
            );
      if (epoch === sessionEpoch()) {
        queryClient.setQueryData<Book[]>(queryKey, (current = []) => [
          result,
          ...current.filter((item) => item.id !== optimistic.id && item.id !== result.id),
        ]);
        await queryClient.invalidateQueries({ queryKey });
      }
    } catch {
      if (epoch === sessionEpoch()) {
        queryClient.setQueryData(queryKey, previous);
        setError("No pudimos guardar.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!user || !saved || busy) return;
    const previous = queryClient.getQueryData<Book[]>(queryKey) ?? books;
    const epoch = sessionEpoch();
    await queryClient.cancelQueries({ queryKey });
    if (epoch !== sessionEpoch()) return;
    queryClient.setQueryData<Book[]>(
      queryKey,
      previous.filter((item) => item.id !== saved.id),
    );
    setBusy(true);
    setError("");
    try {
      await removeBook(user.id, saved.id);
      if (epoch === sessionEpoch()) {
        await queryClient.invalidateQueries({ queryKey });
        onClose();
      }
    } catch {
      if (epoch === sessionEpoch()) {
        queryClient.setQueryData(queryKey, previous);
        setError("No pudimos quitar.");
        setBusy(false);
      }
    }
  }

  async function share() {
    const content = `${book.title}${book.author ? ` — ${book.author}` : ""} ${location.origin}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: book.title, text: content, url: location.origin });
      } catch {
        /* Cancelled by user. */
      }
    } else {
      try {
        await navigator.clipboard.writeText(content);
        setCopied(true);
        const duration = getComputedStyle(document.documentElement)
          .getPropertyValue("--dur-glow")
          .trim();
        window.setTimeout(
          () => setCopied(false),
          parseFloat(duration) * (duration.endsWith("ms") ? 1 : 1000),
        );
      } catch {
        setError("No pudimos copiar.");
      }
    }
  }

  return (
    <Sheet onClose={onClose} label={book.title}>
      <div className="drawer-body book-sheet-body">
        <BookCover url={cover} isbn={book.isbn} large />
        <div className="drawer-hero-content">
          <h2 className="drawer-title">{book.title}</h2>
          {(book.author || book.genre) && (
            <div className="drawer-meta">
              {[book.author, book.genre].filter(Boolean).join(" · ")}
            </div>
          )}
          {book.synopsis && <p className="drawer-description">{book.synopsis}</p>}
        </div>
        <div className="drawer-action-dock" aria-label="Acciones del libro">
          <button
            className={`drawer-action${saved?.status === "quiero" ? " active" : ""}`}
            onClick={() => void choose("quiero")}
            disabled={busy}
            aria-label="Quiero"
          >
            <Heart
              className={popped === "quiero" ? "heart-pop" : undefined}
              onAnimationEnd={() => setPopped(null)}
              size={24}
              strokeWidth={2}
              fill={saved?.status === "quiero" ? "currentColor" : "none"}
            />
            <span className="drawer-action-label">QUIERO</span>
          </button>
          <button
            className={`drawer-action${saved?.status === "lei" ? " active" : ""}`}
            onClick={() => void choose("lei")}
            disabled={busy}
            aria-label="Leí"
          >
            <Check
              className={popped === "lei" ? "heart-pop" : undefined}
              onAnimationEnd={() => setPopped(null)}
              size={24}
              strokeWidth={2}
            />
            <span className="drawer-action-label">LEÍ</span>
          </button>
          <button className="drawer-action" onClick={() => void share()} aria-label="Compartir">
            <Share2 size={24} strokeWidth={2} />
            <span className="drawer-action-label">{copied ? "COPIADO" : "COMPARTIR"}</span>
          </button>
        </div>
        {saved &&
          (confirm ? (
            <div className="drawer-choice-dock">
              <button className="drawer-choice" onClick={() => setConfirm(false)}>
                Cancelar
              </button>
              <button
                className="drawer-choice active"
                onClick={() => void remove()}
                disabled={busy}
              >
                Quitar
              </button>
            </div>
          ) : (
            <button className="drawer-cta" onClick={() => setConfirm(true)}>
              Quitar de mis libros
            </button>
          ))}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
