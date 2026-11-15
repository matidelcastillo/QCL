import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Book, BookStatus } from "../domain/types";
import { ensureBook } from "../data/library";
import { useSession } from "../data/session-context";
import { sessionEpoch } from "../data/session-epoch";
import { buttonClass } from "./button";
import { Sheet } from "./sheet";

/* Manual entry: same .drawer-surface, QC inputs and .drawer-choice-dock. */
export function ManualSheet({
  isbn,
  onClose,
  onSaved,
}: {
  isbn: string | null;
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
    if (!user || !title.trim() || busy) return;
    const epoch = sessionEpoch();
    setBusy(true);
    setError("");
    try {
      const book = await ensureBook(
        user.id,
        {
          title,
          author,
          isbn,
          source: "manual",
          external_id: null,
          page_count: null,
          published_year: null,
          genre: null,
          synopsis: null,
          coverUrl: null,
        },
        status,
      );
      if (epoch !== sessionEpoch()) return;
      await queryClient.invalidateQueries({ queryKey: ["books", user.id] });
      onSaved(book);
    } catch {
      if (epoch === sessionEpoch()) {
        setError("No pudimos guardar.");
        setBusy(false);
      }
    }
  }

  return (
    <Sheet onClose={onClose} label="A mano">
      <form className="drawer-body drawer-body-enter stack" onSubmit={(event) => void save(event)}>
        <h2 className="drawer-title">A mano</h2>
        <input
          className="qc-auth-email-input"
          placeholder="Título"
          aria-label="Título"
          maxLength={500}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
        <input
          className="qc-auth-email-input"
          placeholder="Autor"
          aria-label="Autor"
          maxLength={500}
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
        />
        <div className="drawer-choice-dock" role="group" aria-label="Estado">
          {(
            [
              ["quiero", "Quiero"],
              ["lei", "Leí"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`drawer-choice${status === value ? " drawer-choice-active" : ""}`}
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="submit"
          className={buttonClass("primary", true)}
          disabled={!title.trim() || busy}
        >
          Guardar
        </button>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </form>
    </Sheet>
  );
}
