import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { StatusChoice } from "@/components/status-tabs";
import { useAuth } from "@/lib/auth-session";
import {
  BRAND_HEADER_PADDING,
  brandSubtitleStyle,
  brandTitleStyle,
} from "@/lib/brand-header-style";
import { todayIsoDate } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import type { BookStatus } from "@/lib/types";

const FONT = "'Plus Jakarta Sans', Helvetica, Arial, sans-serif";

export const Route = createFileRoute("/agregar")({
  component: Agregar,
});

function Agregar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [status, setStatus] = useState<BookStatus>("quiero");
  const [readAt, setReadAt] = useState(todayIsoDate());
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user || busy) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    setBusy(true);
    try {
      const { error } = await getSupabase()
        .from("books")
        .insert({
          owner_id: user.id,
          title: trimmedTitle,
          author: author.trim(),
          status,
          read_at: status === "lei" ? readAt || todayIsoDate() : null,
        });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["books", user.id] });
      toast.success("Listo, quedó en tu lista.");
      await navigate({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo agregar.");
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
            Agregar
          </h1>
        </div>
        <p style={{ ...brandSubtitleStyle(FONT, "#C0BCB6"), margin: 0 }}>Un libro, a mano.</p>
      </header>

      <form className="qcl-form" onSubmit={(event) => void handleSubmit(event)}>
        <label className="qcl-field">
          <span>Título</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoComplete="off"
            required
          />
        </label>
        <label className="qcl-field">
          <span>Autor</span>
          <input
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            autoComplete="off"
          />
        </label>
        <div className="qcl-field">
          <span>Estado</span>
          <StatusChoice value={status} onChange={setStatus} />
        </div>
        {status === "lei" ? (
          <label className="qcl-field">
            <span>Cuándo lo leíste</span>
            <input type="date" value={readAt} onChange={(event) => setReadAt(event.target.value)} />
          </label>
        ) : null}
        <button type="submit" className="qcl-primary-btn" disabled={busy || !title.trim()}>
          Guardar
        </button>
      </form>
    </main>
  );
}
