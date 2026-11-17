import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { Book } from "../domain/types";
import { deleteAccount, signOut } from "../data/auth-actions";
import { useSession } from "../data/session-context";
import { useBooks } from "../data/use-books";
import { BrandHeader, ScreenHeading } from "../components/brand-header";
import { BookRow } from "../components/book-row";
import { BookSheet } from "../components/book-sheet";
import { LoadError } from "../components/feedback";
import { LoadingCounts } from "../components/skeleton";
import { useDeferredPending } from "../components/use-deferred-pending";
import { Sheet } from "../components/sheet";
import { buttonClass } from "../components/button";

export const Route = createFileRoute("/vos")({ component: Profile });

function Profile() {
  const { user } = useSession();
  const navigate = useNavigate();
  const books = useBooks(user?.id);
  const [selected, setSelected] = useState<Book | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const showSkeleton = useDeferredPending(books.isPending);

  const library = books.data ?? [];
  const want = library.filter((book) => book.status === "quiero").length;
  const read = library.filter((book) => book.status === "lei");
  const latest = read
    .filter((book) => book.read_at)
    .sort((a, b) => (b.read_at ?? "").localeCompare(a.read_at ?? ""))[0];

  async function leave() {
    setBusy(true);
    setError("");
    try {
      await signOut();
      await navigate({ to: "/entrar" });
    } catch {
      setError("No pudimos salir.");
      setBusy(false);
    }
  }

  async function removeAccount() {
    setBusy(true);
    setError("");
    try {
      await deleteAccount();
      await navigate({ to: "/entrar" });
    } catch {
      setError("No pudimos eliminar la cuenta.");
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <main className="page-pb-nav">
      <BrandHeader />
      <ScreenHeading>Tu racconto</ScreenHeading>
      <div className="stack-loose app-gutter feed" aria-busy={books.isPending}>
        {showSkeleton ? (
          <LoadingCounts />
        ) : books.isPending ? null : books.isError ? (
          <LoadError retry={() => void books.refetch()} />
        ) : (
          <>
            <div className="count-row">
              <button
                type="button"
                className="count-block qc-press"
                onClick={() => void navigate({ to: "/", search: { f: "lei" } })}
              >
                <span className="count-number">{read.length}</span>
                <span className="count-label">Leíste</span>
              </button>
              <button
                type="button"
                className="count-block qc-press"
                onClick={() => void navigate({ to: "/", search: { f: "quiero" } })}
              >
                <span className="count-number">{want}</span>
                <span className="count-label">Querés leer</span>
              </button>
            </div>
            {latest && (
              <section>
                <p className="section-label">Último leído</p>
                <BookRow book={latest} onOpen={() => setSelected(latest)} />
              </section>
            )}
          </>
        )}
        <button
          type="button"
          className="text-action qc-press"
          disabled={busy}
          onClick={() => void leave()}
        >
          Salir
        </button>
        <button
          type="button"
          className="text-action qc-press"
          disabled={busy}
          onClick={() => {
            setError("");
            setConfirmDelete(true);
          }}
        >
          Eliminar cuenta
        </button>
        <Link to="/privacidad" className="text-action">
          Privacidad
        </Link>
        <Link to="/soporte" className="text-action">
          Soporte
        </Link>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </div>
      {selected && <BookSheet book={selected} onClose={() => setSelected(null)} />}
      {confirmDelete && (
        <Sheet onClose={() => !busy && setConfirmDelete(false)} label="Eliminar cuenta">
          <div className="drawer-body stack">
            <p className="legal-copy">Se borra tu cuenta y todos tus libros.</p>
            <button
              type="button"
              className={buttonClass("primary", true)}
              disabled={busy}
              onClick={() => void removeAccount()}
            >
              Eliminar cuenta
            </button>
            <button
              type="button"
              className="text-action qc-press"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
            >
              Cancelar
            </button>
          </div>
        </Sheet>
      )}
    </main>
  );
}
