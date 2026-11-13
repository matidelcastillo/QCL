import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import type { Book } from "../domain/types";
import { profileName, saveProfileName } from "../data/library";
import { signOut } from "../data/auth-actions";
import { useSession } from "../data/session-context";
import { useBooks } from "../data/use-books";
import { BrandHeader, ScreenHeading } from "../components/brand-header";
import { BookRow } from "../components/book-row";
import { BookSheet } from "../components/book-sheet";
import { buttonClass } from "../components/button";
import { LoadError, LoadingRows } from "../components/feedback";

export const Route = createFileRoute("/vos")({ component: Profile });

function Profile() {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const books = useBooks(user?.id);
  const profile = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => profileName(user!.id),
    enabled: Boolean(user),
  });
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Book | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setName(profile.data ?? ""), [profile.data]);

  const library = books.data ?? [];
  const want = library.filter((book) => book.status === "quiero").length;
  const read = library.filter((book) => book.status === "lei");
  const latest = read
    .filter((book) => book.read_at)
    .sort((a, b) => (b.read_at ?? "").localeCompare(a.read_at ?? ""))[0];

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      await saveProfileName(user.id, name);
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    } catch {
      setError("No pudimos guardar.");
    } finally {
      setBusy(false);
    }
  }

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

  return (
    <main className="page-pb-nav">
      <BrandHeader />
      <ScreenHeading>{profile.data || "Vos"}</ScreenHeading>
      <div className="stack-loose app-gutter feed">
        {books.isPending ? (
          <LoadingRows count={2} />
        ) : books.isError ? (
          <LoadError retry={() => void books.refetch()} />
        ) : (
          <>
            <div className="count-row">
              <button
                type="button"
                className="count-block qc-press"
                onClick={() => void navigate({ to: "/", search: { f: "quiero" } })}
              >
                <span className="count-number">{want}</span>
                <span className="count-label">Quiero</span>
              </button>
              <button
                type="button"
                className="count-block qc-press"
                onClick={() => void navigate({ to: "/", search: { f: "lei" } })}
              >
                <span className="count-number">{read.length}</span>
                <span className="count-label">Leí</span>
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
        <form className="stack" onSubmit={(event) => void save(event)}>
          <input
            className="qc-auth-email-input"
            aria-label="Nombre"
            placeholder="Nombre"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button
            type="submit"
            className={buttonClass("primary", true)}
            disabled={busy || name.trim() === (profile.data ?? "")}
          >
            Guardar
          </button>
        </form>
        <button
          type="button"
          className={buttonClass("secondary", true)}
          disabled={busy}
          onClick={() => void leave()}
        >
          Salir
        </button>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </div>
      {selected && <BookSheet book={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
