import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { Book, BookStatus } from "../domain/types";
import { useSession } from "../data/session-context";
import { useBooks } from "../data/use-books";
import { useProfileName } from "../data/use-profile-name";
import { BrandHeader } from "../components/brand-header";
import { BookRow } from "../components/book-row";
import { BookSheet } from "../components/book-sheet";
import { EmptyState, LoadError, LoadingRows } from "../components/feedback";
import { buttonClass } from "../components/button";

type Filter = "todos" | BookStatus;
const filters: Array<[Filter, string]> = [
  ["todos", "Todos"],
  ["quiero", "Quiero"],
  ["lei", "Leí"],
];

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { f?: BookStatus } =>
    search.f === "quiero" || search.f === "lei" ? { f: search.f } : {},
  component: Home,
});

/* QC routes/index.tsx home: brand header, filter tabs row, feed. */
function Home() {
  const { user } = useSession();
  const { f } = Route.useSearch();
  const navigate = useNavigate();
  const filter: Filter = f ?? "todos";
  const [selected, setSelected] = useState<Book | null>(null);
  const books = useBooks(user?.id);
  const name = useProfileName(user?.id).data?.trim();
  const visible = (books.data ?? []).filter((book) => filter === "todos" || book.status === filter);

  return (
    <main className="page-pb-nav">
      <BrandHeader heading subtitle={name ? `Wendía ${name}` : undefined} />
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
      </div>
      <section className="feed app-gutter">
        {books.isPending ? (
          <LoadingRows count={5} />
        ) : books.isError ? (
          <LoadError retry={() => void books.refetch()} />
        ) : visible.length > 0 ? (
          <div key={filter} className="content-fade">
            {visible.map((book) => (
              <BookRow key={book.id} book={book} onOpen={() => setSelected(book)} />
            ))}
          </div>
        ) : filter === "todos" ? (
          <EmptyState text="Nada todavía." art>
            <Link to="/agregar" className={buttonClass("primary")}>
              Agregar
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
