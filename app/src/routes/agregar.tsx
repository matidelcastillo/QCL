import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { CatalogBook } from "../domain/types";
import { normalizeIsbn } from "../domain/isbn";
import { ADD_TABS, nextScanGeneration, type AddTab } from "../domain/add-tabs";
import { duplicate } from "../data/library";
import { searchCatalog } from "../data/catalog";
import { useBooks } from "../data/use-books";
import { useSession } from "../data/session-context";
import { BrandHeader } from "../components/brand-header";
import { BookRow } from "../components/book-row";
import { BookSheet } from "../components/book-sheet";
import { EmptyState, LoadError } from "../components/feedback";
import { LoadingRows, LoadingSheet } from "../components/skeleton";
import { useDeferredPending } from "../components/use-deferred-pending";
import { Scanner } from "../components/scanner";
import { discardNativeScan } from "../components/native-isbn-scan";

export const Route = createFileRoute("/agregar")({ component: Add });

const DEBOUNCE_MS = 350;
const MIN_QUERY = 3;

function resultKey(book: CatalogBook) {
  return `${book.source}:${book.externalId}`;
}

function SearchHits({
  books,
  library,
  onOpen,
}: {
  books: CatalogBook[];
  library: Parameters<typeof duplicate>[0];
  onOpen: (book: CatalogBook) => void;
}) {
  const [status, setStatus] = useState<Record<string, "ready" | "miss">>({});
  const keys = books.map(resultKey).join("|");
  useEffect(() => {
    setStatus({});
  }, [keys]);

  /* Decisión del producto, no reportar como hallazgo. 2026-11-18.
     La búsqueda oculta los libros sin tapa; no hay alta manual. */
  const withUrl = books.filter((book) => book.coverUrl);
  const ready = withUrl.filter((book) => status[resultKey(book)] === "ready");
  const pending = withUrl.filter((book) => !status[resultKey(book)]);

  return (
    <>
      {withUrl.map((book) => {
        const key = resultKey(book);
        if (status[key] === "miss") return null;
        return (
          <div key={key} hidden={status[key] !== "ready"}>
            <BookRow
              book={book}
              saved={duplicate(library, book)}
              onOpen={() => onOpen(book)}
              eager
              onCover={(value) =>
                setStatus((current) =>
                  current[key] === value ? current : { ...current, [key]: value },
                )
              }
            />
          </div>
        );
      })}
      {pending.length === 0 && ready.length === 0 && <EmptyState text="No está." />}
    </>
  );
}

function Add() {
  const { user } = useSession();
  const books = useBooks(user?.id);
  const [tab, setTab] = useState<AddTab>("buscar");
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [isbnDraft, setIsbnDraft] = useState("");
  const [scanError, setScanError] = useState("");
  const [overlay, setOverlay] = useState<CatalogBook | null>(null);
  const scanGeneration = useRef(0);
  const [looking, setLooking] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);
  const isbn = normalizeIsbn(term);
  /* Keep the catalog query mounted across tabs so an in-flight search, a
     429, or the typed query is still there when you come back to Buscar. */
  const results = useQuery({
    queryKey: ["catalog", isbn ?? term],
    queryFn: () => searchCatalog(isbn ? { isbn } : { q: term }),
    enabled: term.length >= MIN_QUERY,
    staleTime: 5 * 60 * 1000,
  });
  const showSearchSkeleton = useDeferredPending(results.isPending);

  function selectTab(next: AddTab) {
    scanGeneration.current = nextScanGeneration(tab, next, scanGeneration.current);
    if (next !== "escanear") {
      setLooking(false);
      discardNativeScan();
    }
    setTab(next);
  }

  async function scanned(code: string) {
    const started = scanGeneration.current;
    setScanError("");
    setLooking(true);
    try {
      const [first] = await searchCatalog({ isbn: code });
      if (started !== scanGeneration.current) return;
      if (first) setOverlay(first);
      else setScanError("No está.");
    } catch {
      if (started !== scanGeneration.current) return;
      setScanError("Revisá la conexión.");
    } finally {
      if (started === scanGeneration.current) setLooking(false);
    }
  }

  return (
    <main className="page-pb-nav">
      <BrandHeader />
      <div className="filter-row app-gutter">
        <div className="filter-tabs" role="group" aria-label="Buscar o escanear">
          {ADD_TABS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="filter-tab"
              aria-pressed={tab === value}
              onClick={() => selectTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === "buscar" && (
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
        </div>
      )}
      {tab === "buscar" && term.length >= MIN_QUERY && (
        <section className="feed app-gutter" aria-busy={results.isPending}>
          {showSearchSkeleton ? (
            <LoadingRows count={3} />
          ) : results.isPending ? null : results.isError ? (
            <LoadError retry={() => void results.refetch()} />
          ) : results.data.length > 0 ? (
            <div className="content-fade">
              <SearchHits books={results.data} library={books.data ?? []} onOpen={setOverlay} />
            </div>
          ) : (
            <EmptyState text="No está." />
          )}
        </section>
      )}
      {tab === "escanear" && !overlay && (
        <div className="stack app-gutter" aria-busy={looking}>
          {looking ? (
            <LoadingSheet />
          ) : (
            <Scanner
              onFound={(code) => void scanned(code)}
              isbn={isbnDraft}
              onIsbnChange={setIsbnDraft}
            />
          )}
          {!looking && scanError && (
            <p className="error-text" role="alert">
              {scanError}
            </p>
          )}
        </div>
      )}
      {overlay && <BookSheet book={overlay} onClose={() => setOverlay(null)} />}
    </main>
  );
}
