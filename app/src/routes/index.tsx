import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { Book, BookStatus } from "../domain/types";
import { useSession } from "../data/session-context";
import { useBooks } from "../data/use-books";
import { BookRow } from "../components/book-row";
import { BookSheet } from "../components/book-sheet";
import { LoadingRows, LoadError } from "../components/feedback";

type Filter = "todos" | BookStatus;
export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { f?: BookStatus } => ({
    f: search.f === "quiero" || search.f === "lei" ? search.f : undefined,
  }),
  component: Home,
});

function Home() {
  const { user } = useSession();
  const { f } = Route.useSearch();
  const navigate = useNavigate();
  const filter: Filter = f ?? "todos";
  const [selected, setSelected] = useState<Book | null>(null);
  const books = useBooks(user?.id);
  const visible = (books.data ?? []).filter((book) => filter === "todos" || book.status === filter);
  function chooseFilter(value: Filter) {
    void navigate({ to: "/", search: { f: value === "todos" ? undefined : value }, replace: true });
  }
  return (
    <>
      <h1 className="brand">
        <span className="brand-accent">que carajo</span> leer
      </h1>
      <main className="page">
        <div className="filter-row" aria-label="Filtrar libros">
          {(["todos", "quiero", "lei"] as Filter[]).map((value) => (
            <button
              key={value}
              type="button"
              className={`filter-pill surface-pill-flat${filter === value ? " active" : ""}`}
              aria-pressed={filter === value}
              onClick={() => chooseFilter(value)}
            >
              {value === "todos" ? "Todos" : value === "quiero" ? "Quiero" : "Leí"}
            </button>
          ))}
        </div>
        {books.isLoading ? (
          <LoadingRows count={5} />
        ) : books.isError ? (
          <LoadError retry={() => void books.refetch()} />
        ) : visible.length ? (
          <div key={filter} className="qc-card-image">
            {visible.map((book) => (
              <BookRow key={book.id} book={book} onClick={() => setSelected(book)} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            {filter === "todos" && <img className="empty-art" src="/empty-state.gif" alt="" />}
            <span>{filter === "todos" ? "Nada todavía." : "Nada acá."}</span>
            {filter === "todos" && (
              <Link to="/agregar" className="primary-button">
                Agregar
              </Link>
            )}
          </div>
        )}
      </main>
      {selected && <BookSheet book={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
