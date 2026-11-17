import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CatalogBook, ManualBook } from "../domain/types";
import { normalizeIsbn } from "../domain/isbn";
import { ADD_TABS, nextScanGeneration, type AddTab } from "../domain/add-tabs";
import { duplicate, manualBook } from "../data/library";
import { searchCatalog } from "../data/catalog";
import { useBooks } from "../data/use-books";
import { useSession } from "../data/session-context";
import { BrandHeader } from "../components/brand-header";
import { BookRow } from "../components/book-row";
import { BookSheet } from "../components/book-sheet";
import { buttonClass } from "../components/button";
import { EmptyState, LoadError } from "../components/feedback";
import { LoadingRows, LoadingSheet } from "../components/skeleton";
import { useDeferredPending } from "../components/use-deferred-pending";
import { Scanner } from "../components/scanner";

export const Route = createFileRoute("/agregar")({ component: Add });

const DEBOUNCE_MS = 350;
const MIN_QUERY = 3;

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
  const [tab, setTab] = useState<AddTab>("buscar");
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [isbnDraft, setIsbnDraft] = useState("");
  const [scanError, setScanError] = useState("");
  const [missedIsbn, setMissedIsbn] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<CatalogBook | ManualBook | null>(null);
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
    if (next !== "escanear") setLooking(false);
    setTab(next);
  }

  async function scanned(code: string) {
    const started = scanGeneration.current;
    setScanError("");
    setMissedIsbn(null);
    setLooking(true);
    try {
      const [first] = await searchCatalog({ isbn: code });
      if (started !== scanGeneration.current) return;
      if (first) setOverlay(first);
      else {
        setScanError("No está.");
        setMissedIsbn(code);
      }
    } catch {
      if (started !== scanGeneration.current) return;
      setScanError("Revisá la conexión.");
    } finally {
      if (started === scanGeneration.current) setLooking(false);
    }
  }

  function openManual(book: ManualBook) {
    setOverlay(book);
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
              {results.data.map((book) => (
                <BookRow
                  key={`${book.source}:${book.externalId}`}
                  book={book}
                  saved={duplicate(books.data ?? [], book)}
                  onOpen={() => setOverlay(book)}
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
          {!looking && missedIsbn && (
            <ManualForm key={missedIsbn} isbn={missedIsbn} onOpen={openManual} />
          )}
        </div>
      )}
      {overlay && <BookSheet book={overlay} onClose={() => setOverlay(null)} />}
    </main>
  );
}
