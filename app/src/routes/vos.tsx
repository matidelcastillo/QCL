import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { profileName, saveProfileName } from "../data/library";
import { signOut } from "../data/auth-actions";
import { useSession } from "../data/session-context";
import { useBooks } from "../data/use-books";
import type { Book } from "../domain/types";
import { BookRow } from "../components/book-row";
import { BookSheet } from "../components/book-sheet";
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
  useEffect(() => {
    setName(profile.data ?? "");
  }, [profile.data]);
  const want = (books.data ?? []).filter((item) => item.status === "quiero").length;
  const read = (books.data ?? []).filter((item) => item.status === "lei").length;
  const latest = [...(books.data ?? [])]
    .filter((item) => item.status === "lei" && item.read_at)
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
    <main className="page">
      <h1 className="screen-title">{profile.data || "Vos"}</h1>
      {books.isLoading ? (
        <LoadingRows count={2} />
      ) : books.isError ? (
        <LoadError retry={() => void books.refetch()} />
      ) : (
        <>
          <div className="count-row">
            <button
              className="count-block"
              onClick={() => void navigate({ to: "/", search: { f: "quiero" } })}
            >
              <span className="count-number">{want}</span>
              <span className="count-label">Quiero</span>
            </button>
            <button
              className="count-block"
              onClick={() => void navigate({ to: "/", search: { f: "lei" } })}
            >
              <span className="count-number">{read}</span>
              <span className="count-label">Leí</span>
            </button>
          </div>
          {latest && (
            <>
              <p className="section-label">Último leído</p>
              <BookRow book={latest} onClick={() => setSelected(latest)} />
            </>
          )}
        </>
      )}
      <form className="form-stack" onSubmit={(event) => void save(event)}>
        <input
          className="qc-auth-email-input"
          aria-label="Nombre"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button
          className="primary-button qc-press"
          disabled={busy || name.trim() === (profile.data ?? "")}
        >
          Guardar
        </button>
      </form>
      <button className="secondary-button qc-press" onClick={() => void leave()} disabled={busy}>
        Salir
      </button>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {selected && <BookSheet book={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
