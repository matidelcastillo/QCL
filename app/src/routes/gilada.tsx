import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { SharedBook } from "../domain/types";
import { useSession } from "../data/session-context";
import { useSharedBooks } from "../data/shared-books";
import { BrandHeader, ScreenHeading } from "../components/brand-header";
import { BookSheet } from "../components/book-sheet";
import { BookTile } from "../components/book-tile";
import { EmptyState, LoadError } from "../components/feedback";
import { LoadingTiles } from "../components/skeleton";
import { useDeferredPending } from "../components/use-deferred-pending";

export const Route = createFileRoute("/gilada")({ component: Gilada });

/* Always the same 3-column cover grid as home. No list and no view toggle. */
function Gilada() {
  const { user } = useSession();
  const books = useSharedBooks(Boolean(user));
  const [selected, setSelected] = useState<SharedBook | null>(null);
  const showSkeleton = useDeferredPending(books.isPending);

  return (
    <main className="page-pb-nav">
      <BrandHeader />
      <ScreenHeading>Qué lee la gilada</ScreenHeading>
      <section className="feed app-gutter" aria-busy={books.isPending}>
        {showSkeleton ? (
          <LoadingTiles count={9} />
        ) : books.isPending ? null : books.isError ? (
          <LoadError retry={() => void books.refetch()} />
        ) : books.data.length > 0 ? (
          <div className="book-grid">
            {books.data.map((book, index) => (
              <BookTile
                key={`${book.source}:${book.externalId ?? book.isbn ?? book.title}`}
                book={book}
                index={index}
                onOpen={() => setSelected(book)}
              />
            ))}
          </div>
        ) : (
          <EmptyState text="Todavía nada." art />
        )}
      </section>
      {selected && <BookSheet book={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
