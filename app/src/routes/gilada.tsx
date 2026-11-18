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
import { isCoverRevealed, useCoverStatus } from "../components/use-cover-status";

export const Route = createFileRoute("/gilada")({ component: Gilada });

/* Always the same 3-column cover grid as home. No list and no view toggle. */
function Gilada() {
  const { user } = useSession();
  const books = useSharedBooks(Boolean(user));
  const [selected, setSelected] = useState<SharedBook | null>(null);
  const showSkeleton = useDeferredPending(books.isPending);
  const { status, report } = useCoverStatus();
  const coverKey = (book: SharedBook) =>
    `${book.source}:${book.externalId ?? book.isbn ?? book.title}`;
  const shared = books.data ?? [];
  const waitingForCovers =
    shared.length > 0 && !shared.some((book) => isCoverRevealed(status, coverKey(book)));

  return (
    <main className="page-pb-nav">
      <BrandHeader />
      <ScreenHeading>Qué lee la gilada</ScreenHeading>
      <section className="feed app-gutter" aria-busy={books.isPending || waitingForCovers}>
        {showSkeleton || (!books.isPending && !books.isError && waitingForCovers) ? (
          <LoadingTiles count={9} />
        ) : null}
        {showSkeleton || books.isPending ? null : books.isError ? (
          <LoadError retry={() => void books.refetch()} />
        ) : shared.length > 0 ? (
          <div className="book-grid" hidden={waitingForCovers}>
            {shared.map((book, index) => {
              const key = coverKey(book);
              return (
                <div key={key} hidden={!isCoverRevealed(status, key)}>
                  <BookTile
                    book={book}
                    index={index}
                    eager
                    onCover={(value) => report(key, value)}
                    onOpen={() => setSelected(book)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState text="Todavía nada." art />
        )}
      </section>
      {selected && <BookSheet book={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
