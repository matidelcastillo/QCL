import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Book, BookStatus } from "../domain/types";
import { ensureBook } from "../data/library";
import { useSession } from "../data/session-context";
import { sessionEpoch } from "../data/session-epoch";
import { Sheet } from "./sheet";

export function ManualSheet({
  isbn,
  onClose,
  onSaved,
}: {
  isbn?: string | null;
  onClose: () => void;
  onSaved: (book: Book) => void;
}) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [status, setStatus] = useState<BookStatus>("quiero");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!user || !title.trim()) return;
    const epoch = sessionEpoch();
    setBusy(true);
    setError("");
    try {
      const book = await ensureBook(
        user.id,
        {
          title,
          author,
          isbn: isbn ?? null,
          coverUrl: null,
          page_count: null,
          published_year: null,
          genre: null,
          synopsis: null,
          source: "manual",
        },
        status,
      );
      if (epoch === sessionEpoch()) {
        await queryClient.invalidateQueries({ queryKey: ["books", user.id] });
        onSaved(book);
      }
    } catch {
      if (epoch === sessionEpoch()) {
        setError("No pudimos guardar.");
        setBusy(false);
      }
    }
  }
  return (
    <Sheet onClose={onClose} label="A mano">
      <div className="drawer-body form-stack">
        <h2 className="drawer-title">A mano</h2>
        <form className="form-stack" onSubmit={(event) => void save(event)}>
          <input
            className="qc-auth-code-input"
            placeholder="Título"
            aria-label="Título"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
          <input
            className="qc-auth-code-input"
            placeholder="Autor"
            aria-label="Autor"
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
          />
          <div className="drawer-choice-dock">
            <button
              type="button"
              className={`drawer-choice${status === "quiero" ? " active" : ""}`}
              onClick={() => setStatus("quiero")}
            >
              Quiero
            </button>
            <button
              type="button"
              className={`drawer-choice${status === "lei" ? " active" : ""}`}
              onClick={() => setStatus("lei")}
            >
              Leí
            </button>
          </div>
          <button className="primary-button" disabled={!title.trim() || busy}>
            Guardar
          </button>
        </form>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
