import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LayoutGrid, List } from "lucide-react";
import { useState } from "react";
import { groupByGenre } from "../domain/genre";
import type { Book, BookStatus } from "../domain/types";
import { useSession } from "../data/session-context";
import { useBooks } from "../data/use-books";
import { BrandHeader } from "../components/brand-header";
import { BookRow } from "../components/book-row";
import { BookSheet } from "../components/book-sheet";
import { BookTile } from "../components/book-tile";
import { EmptyState, LoadError, LoadingRows } from "../components/feedback";
import { buttonClass } from "../components/button";

type Filter = "todos" | BookStatus;
type View = "list" | "grid";
/* Labels end in a period, like QC's filter tabs ("Hoy." "Cerca." "Gratis."). */
const filters: Array<[Filter, string]> = [
  ["todos", "Todos."],
  ["lei", "Leí."],
  ["quiero", "Quiero leer."],
];

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { f?: BookStatus } =>
    search.f === "quiero" || search.f === "lei" ? { f: search.f } : {},
  component: Home,
});

/* QC routes/index.tsx home: brand header, filter tabs row with the view
   toggle (l. 1941-1968, not persisted, like QC). The list groups by genre the
   way QC groups the feed by day (AgendaTimeline l. 3536-3640); the grid shows
   every cover in one grid. */
function Home() {
  const { user } = useSession();
  const { f } = Route.useSearch();
  const navigate = useNavigate();
  const filter: Filter = f ?? "todos";
  const [selected, setSelected] = useState<Book | null>(null);
  const [view, setView] = useState<View>("list");
  const books = useBooks(user?.id);
  const visible = (books.data ?? []).filter((book) => filter === "todos" || book.status === filter);

  return (
    <main className="page-pb-nav">
      <BrandHeader heading />
      <div className="filter-row app-gutter">
        <div className="filter-tabs" role="group" aria-label="Filtrar">
          {filters.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="filter-tab"
              aria-pressed={filter === value}
              onClick={() =>
                void navigate({
                  to: "/",
                  search: value === "todos" ? {} : { f: value },
                  replace: true,
                })
              }
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="filter-action-icon"
          aria-label={view === "list" ? "Ver libros en grilla" : "Ver libros en lista"}
          title={view === "list" ? "Ver libros en grilla" : "Ver libros en lista"}
          onClick={() => setView((current) => (current === "list" ? "grid" : "list"))}
        >
          <span key={view} className="content-fade filter-action-glyph">
            {view === "list" ? <LayoutGrid aria-hidden="true" /> : <List aria-hidden="true" />}
          </span>
        </button>
      </div>
      <section className="feed app-gutter">
        {books.isPending ? (
          <LoadingRows count={5} />
        ) : books.isError ? (
          <LoadError retry={() => void books.refetch()} />
        ) : visible.length > 0 ? (
          <div key={`${filter}-${view}`} className="content-fade">
            {view === "grid" ? (
              <div className="book-grid">
                {visible.map((book, index) => (
                  <BookTile
                    key={book.id}
                    book={book}
                    index={index}
                    onOpen={() => setSelected(book)}
                  />
                ))}
              </div>
            ) : (
              groupByGenre(visible).map(([genre, items]) => (
                <section key={genre} className="feed-group" aria-label={genre}>
                  <h2 className="feed-group-label">{genre.toLowerCase()}</h2>
                  {items.map((book) => (
                    <BookRow key={book.id} book={book} onOpen={() => setSelected(book)} />
                  ))}
                </section>
              ))
            )}
          </div>
        ) : filter === "todos" ? (
          <EmptyState text="Nada todavía." art>
            <Link to="/agregar" className={buttonClass("primary")}>
              Buscar
            </Link>
          </EmptyState>
        ) : (
          <EmptyState key={filter} text="Nada acá." />
        )}
      </section>
      {selected && <BookSheet book={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
