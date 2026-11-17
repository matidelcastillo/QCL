import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Barcode } from "lucide-react";
import type { Book, CatalogBook, ManualBook } from "../domain/types";
import { normalizeIsbn } from "../domain/isbn";
import { duplicate, manualBook } from "../data/library";
import { searchCatalog } from "../data/catalog";
import { useBooks } from "../data/use-books";
import { useSession } from "../data/session-context";
import { BrandHeader, ScreenHeading } from "../components/brand-header";
import { BookRow } from "../components/book-row";
import { BookSheet } from "../components/book-sheet";
import { buttonClass } from "../components/button";
import { EmptyState, LoadError, LoadingRows } from "../components/feedback";
import { Scanner } from "../components/scanner";

export const Route = createFileRoute("/agregar")({ component: Add });

const DEBOUNCE_MS = 350;
const MIN_QUERY = 3;

type Overlay = { kind: "book"; book: Book | CatalogBook | ManualBook } | { kind: "scanner" } | null;

function ManualForm({
  isbn,
  title: initialTitle = "",
  onOpen,
}: {
  isbn?: string | null;
  title?: string;
  onOpen: (book: ManualBook) => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [author, setAuthor] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const book = manualBook({ title, author, isbn });
    if (!book.title) return;
    onOpen(book);
  }
  return (
    <form className="stack" onSubmit={submit}>
      <input
        className="qc-auth-email-input"
        type="text"
        placeholder="Título"
        aria-label="Título"
        autoComplete="off"
        maxLength={500}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        required
      />
      <input
        className="qc-auth-email-input"
        type="text"
        placeholder="Autor"
        aria-label="Autor"
        autoComplete="off"
        maxLength={500}
        value={author}
        onChange={(event) => setAuthor(event.target.value)}
      />
      {isbn && <p className="qc-feedback-text">{isbn}</p>}
      <button type="submit" className={buttonClass("primary", true)}>
        Cargarlo
      </button>
    </form>
  );
}

function Add() {
  const { user } = useSession();
  const books = useBooks(user?.id);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [scanError, setScanError] = useState("");
  const [missedIsbn, setMissedIsbn] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);
  const isbn = normalizeIsbn(term);
  const results = useQuery({
    queryKey: ["catalog", isbn ?? term],
    queryFn: () => searchCatalog(isbn ? { isbn } : { q: term }),
    enabled: term.length >= MIN_QUERY,
    staleTime: 5 * 60 * 1000,
  });

  async function scanned(code: string) {
    setOverlay(null);
    setScanError("");
    setMissedIsbn(null);
    setQuery("");
    setTerm("");
    try {
      const [first] = await searchCatalog({ isbn: code });
      if (first) setOverlay({ kind: "book", book: first });
      else {
        setScanError("No está.");
        setMissedIsbn(code);
      }
    } catch {
      setScanError("Revisá la conexión.");
    }
  }

  function openManual(book: ManualBook) {
    setOverlay({ kind: "book", book });
  }

  return (
    <main className="page-pb-nav">
      <BrandHeader />
      <ScreenHeading>Buscar</ScreenHeading>
      <div className="stack app-gutter">
        <input
          className="qc-auth-email-input"
          type="search"
          enterKeyHint="search"
          placeholder="Tipeá título o autor"
          aria-label="Buscar"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="button"
          className={buttonClass("primary", true)}
          onClick={() => setOverlay({ kind: "scanner" })}
        >
          <Barcode size={24} strokeWidth={2} aria-hidden="true" />
          Escanear
        </button>
        {scanError && (
          <p className="error-text" role="alert">
            {scanError}
          </p>
        )}
        {missedIsbn && <ManualForm key={missedIsbn} isbn={missedIsbn} onOpen={openManual} />}
      </div>
      {term.length >= MIN_QUERY && (
        <section className="feed app-gutter">
          {results.isPending ? (
            <LoadingRows count={3} />
          ) : results.isError ? (
            <LoadError retry={() => void results.refetch()} />
          ) : results.data.length > 0 ? (
            <div className="content-fade">
              {results.data.map((book) => (
                <BookRow
                  key={`${book.source}:${book.externalId}`}
                  book={book}
                  saved={duplicate(books.data ?? [], book)}
                  onOpen={() => setOverlay({ kind: "book", book })}
                />
              ))}
            </div>
          ) : (
            <>
              <EmptyState text="No está." />
              <ManualForm
                key={`${isbn ?? ""}:${term}`}
                isbn={isbn}
                title={isbn ? "" : term}
                onOpen={openManual}
              />
            </>
          )}
        </section>
      )}
      {overlay?.kind === "scanner" && (
        <Scanner onClose={() => setOverlay(null)} onFound={(code) => void scanned(code)} />
      )}
      {overlay?.kind === "book" && (
        <BookSheet book={overlay.book} onClose={() => setOverlay(null)} />
      )}
    </main>
  );
}
