import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { SharedBook } from "../domain/types";
import { useSession } from "../data/session-context";
import { useSharedBooks } from "../data/shared-books";
import { BrandHeader, ScreenHeading } from "../components/brand-header";
import { BookSheet } from "../components/book-sheet";
import { EmptyState, LoadError, LoadingRows } from "../components/feedback";
import { SharedBookRow } from "../components/shared-book-row";

export const Route = createFileRoute("/gilada")({ component: Gilada });

/* QC routes/index.tsx home: brand header, screen heading, feed of rows. */
function Gilada() {
  const { user } = useSession();
  const shared = useSharedBooks(Boolean(user));
  const [selected, setSelected] = useState<SharedBook | null>(null);
  return (
    <main className="page-pb-nav">
      <BrandHeader />
      <ScreenHeading>Que lee la gilada</ScreenHeading>
      <section className="feed app-gutter">
        {shared.isPending ? (
          <LoadingRows count={3} />
        ) : shared.isError ? (
          <LoadError retry={() => void shared.refetch()} />
        ) : shared.data.length > 0 ? (
          <div className="content-fade">
            {shared.data.map((book) => (
              <SharedBookRow
                key={`${book.isbn ?? ""}:${book.title}:${book.author}`}
                book={book}
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
