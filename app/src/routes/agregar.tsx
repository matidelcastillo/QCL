import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Barcode } from "lucide-react";
import type { Book, CatalogBook } from "../domain/types";
import { normalizeIsbn } from "../domain/isbn";
import { duplicate } from "../data/library";
import { useBooks } from "../data/use-books";
import { useSession } from "../data/session-context";
import { BookRow } from "../components/book-row";
import { BookSheet } from "../components/book-sheet";
import { LoadingRows, LoadError } from "../components/feedback";
import { ManualSheet } from "../components/manual-sheet";
import { Scanner } from "../components/scanner";

export const Route = createFileRoute("/agregar")({ component: Add });

async function search(query: string, isbn?: string): Promise<CatalogBook[]> {
  const params = new URLSearchParams(isbn ? { isbn } : { q: query });
  const response = await fetch(`/api/libros?${params}`);
  if (!response.ok) throw new Error("catalog_search_failed");
  const data = (await response.json()) as { results: CatalogBook[] };
  return data.results;
}

function Add() {
  const { user } = useSession();
  const books = useBooks(user?.id);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<Book | CatalogBook | null>(null);
  const [scanner, setScanner] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualIsbn, setManualIsbn] = useState<string | null>(null);
  const [scanError, setScanError] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);
  const isbn = normalizeIsbn(debounced);
  const results = useQuery({
    queryKey: ["catalog", isbn ?? debounced],
    queryFn: () => search(debounced, isbn ?? undefined),
    enabled: debounced.length > 2,
    staleTime: 300_000,
  });

  async function found(value: string) {
    setScanner(false);
    setScanError("");
    try {
      const matches = await search(value, value);
      if (matches[0]) setSelected(matches[0]);
      else {
        setManualIsbn(value);
        setManual(true);
      }
    } catch {
      setScanError("No pudimos buscar.");
    }
  }

  return (
    <main className="page">
      <h1 className="screen-title">Agregar</h1>
      <div className="form-stack">
        <input
          className="qc-auth-email-input"
          type="search"
          enterKeyHint="search"
          placeholder="Título, autor o ISBN"
          aria-label="Buscar libro"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="action-row">
          <button className="primary-button qc-press" onClick={() => setScanner(true)}>
            <Barcode size={24} strokeWidth={2} /> Escanear
          </button>
          <button
            className="secondary-button qc-press"
            onClick={() => {
              setManualIsbn(null);
              setManual(true);
            }}
          >
            A mano
          </button>
        </div>
      </div>
      {scanError && (
        <p className="error-text" role="alert">
          {scanError}
        </p>
      )}
      {debounced.length > 2 &&
        (results.isLoading ? (
          <LoadingRows count={3} />
        ) : results.isError ? (
          <LoadError retry={() => void results.refetch()} />
        ) : results.data?.length ? (
          results.data.map((book) => (
            <BookRow
              key={`${book.source}:${book.externalId}`}
              book={book}
              saved={duplicate(books.data ?? [], book)}
              onClick={() => setSelected(book)}
            />
          ))
        ) : (
          <div className="empty-state">
            <span>No está.</span>
            <button
              className="secondary-button"
              onClick={() => {
                setManualIsbn(isbn);
                setManual(true);
              }}
            >
              Cargalo a mano
            </button>
          </div>
        ))}
      {scanner && (
        <Scanner onClose={() => setScanner(false)} onFound={(value) => void found(value)} />
      )}
      {manual && (
        <ManualSheet
          isbn={manualIsbn}
          onClose={() => setManual(false)}
          onSaved={(book) => {
            setManual(false);
            setSelected(book);
          }}
        />
      )}
      {selected && <BookSheet book={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
