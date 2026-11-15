import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Barcode } from "lucide-react";
import type { Book, CatalogBook } from "../domain/types";
import { normalizeIsbn } from "../domain/isbn";
import { duplicate } from "../data/library";
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

type Overlay = { kind: "book"; book: Book | CatalogBook } | { kind: "scanner" } | null;

function Add() {
  const { user } = useSession();
  const books = useBooks(user?.id);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [scanError, setScanError] = useState("");
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
    try {
      const [first] = await searchCatalog({ isbn: code });
      if (first) setOverlay({ kind: "book", book: first });
      else setScanError("No está.");
    } catch {
      setScanError("Revisá la conexión.");
    }
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
            <EmptyState text="No está." />
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
