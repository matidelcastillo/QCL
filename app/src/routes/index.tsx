import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BookCover } from "@/components/book-cover";
import { CatalogSearch } from "@/components/catalog-search";
import { BookSheet } from "@/components/book-sheet";
import { StatusTabs } from "@/components/status-tabs";
import { useAuth } from "@/lib/auth-session";
import {
  BRAND_HEADER_PADDING,
  brandSubtitleStyle,
  brandTitleStyle,
} from "@/lib/brand-header-style";
import { formatMonthYear, statusLabel } from "@/lib/format";
import { BOOK_COLUMNS } from "@/lib/books";
import { getSupabase } from "@/lib/supabase";
import type { Book, BookStatus } from "@/lib/types";

const FONT = "'Plus Jakarta Sans', Helvetica, Arial, sans-serif";

export const Route = createFileRoute("/")({
  component: MisLibros,
});

function MisLibros() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"todos" | BookStatus>("todos");
  const [selected, setSelected] = useState<Book | null>(null);
  const [busy, setBusy] = useState(false);
  const [searchingCatalog, setSearchingCatalog] = useState(false);

  const booksQuery = useQuery({
    queryKey: ["books", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("books")
        .select(BOOK_COLUMNS)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Book[];
    },
  });

  const books = booksQuery.data ?? [];
  const visible = filter === "todos" ? books : books.filter((book) => book.status === filter);
  const subtitle =
    books.length === 0
      ? "Sin libros."
      : `${books.length} ${books.length === 1 ? "libro" : "libros"}.`;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["books", user?.id] });
  }

  async function saveBook(
    book: Book,
    values: { title: string; author: string; status: BookStatus; read_at: string | null },
  ) {
    setBusy(true);
    try {
      const { error } = await getSupabase().from("books").update(values).eq("id", book.id);
      if (error) throw error;
      toast.success("Guardado.");
      setSelected(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function removeBook(book: Book) {
    setBusy(true);
    try {
      const { error } = await getSupabase().from("books").delete().eq("id", book.id);
      if (error) throw error;
      toast.success("Listo.");
      setSelected(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo sacar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="qcl-page page-pb-nav">
      <header style={{ padding: BRAND_HEADER_PADDING, paddingLeft: 0, paddingRight: 0 }}>
        <div className="app-brand-header-row">
          <h1
            className="app-brand-title"
            style={{ ...brandTitleStyle(FONT, "#0A0A0A"), margin: 0 }}
          >
            <span style={{ color: "#E8624A" }}>qué carajo</span> <span>leer</span>
          </h1>
        </div>
        <p style={{ ...brandSubtitleStyle(FONT, "#C0BCB6"), margin: 0 }}>{subtitle}</p>
      </header>

      <CatalogSearch afterAdd="stay" onActiveChange={setSearchingCatalog} />

      {searchingCatalog ? null : (
        <>
          <StatusTabs value={filter} onChange={setFilter} />

          {booksQuery.isError ? (
            <p className="qcl-empty">No se pudieron cargar.</p>
          ) : visible.length === 0 ? (
            <p className="qcl-empty">{books.length === 0 ? "Agregá el primero." : "Nada acá."}</p>
          ) : (
            <ul className="qcl-book-list">
              {visible.map((book) => (
                <li key={book.id}>
                  <button
                    type="button"
                    className={`qc-press-card qcl-book-card qcl-book-card-${book.status}`}
                    onClick={() => setSelected(book)}
                  >
                    <BookCover url={book.cover_url} title={book.title} />
                    <span className="qcl-book-copy">
                      <span className="qcl-book-title">{book.title}</span>
                      {book.author ? <span className="qcl-book-author">{book.author}</span> : null}
                      <span className="qcl-book-foot">
                        <span className={`qcl-badge qcl-badge-${book.status}`}>
                          {statusLabel(book.status)}
                        </span>
                        {book.status === "lei" && book.read_at ? (
                          <span className="qcl-book-date">{formatMonthYear(book.read_at)}</span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {selected ? (
        <BookSheet
          book={selected}
          busy={busy}
          onClose={() => setSelected(null)}
          onSave={(values) => saveBook(selected, values)}
          onRemove={() => removeBook(selected)}
        />
      ) : null}
    </main>
  );
}
