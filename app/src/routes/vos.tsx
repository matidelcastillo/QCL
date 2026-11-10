import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-session";
import {
  BRAND_HEADER_PADDING,
  brandSubtitleStyle,
  brandTitleStyle,
} from "@/lib/brand-header-style";
import { formatDate } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import type { Book, Profile } from "@/lib/types";

const FONT = "'Plus Jakarta Sans', Helvetica, Arial, sans-serif";

export const Route = createFileRoute("/vos")({
  component: Vos,
});

function Vos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, created_at, updated_at")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as Profile;
      const { data: created, error: insertError } = await supabase
        .from("profiles")
        .insert({ id: user!.id, name: "" })
        .select("id, name, created_at, updated_at")
        .single();
      if (insertError) throw insertError;
      return created as Profile;
    },
  });

  const booksQuery = useQuery({
    queryKey: ["books", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("books")
        .select("id, owner_id, title, author, status, read_at, created_at, updated_at");
      if (error) throw error;
      return (data ?? []) as Book[];
    },
  });

  useEffect(() => {
    if (profileQuery.data) setName(profileQuery.data.name);
  }, [profileQuery.data]);

  const books = booksQuery.data ?? [];
  const quiero = books.filter((book) => book.status === "quiero").length;
  const lei = books.filter((book) => book.status === "lei").length;
  const lastRead = books
    .filter((book) => book.status === "lei")
    .sort((a, b) => {
      const aKey = a.read_at ?? a.updated_at;
      const bKey = b.read_at ?? b.updated_at;
      return bKey.localeCompare(aKey);
    })[0];

  async function saveName(event: FormEvent) {
    event.preventDefault();
    if (!user || busy) return;
    setBusy(true);
    try {
      const { error } = await getSupabase()
        .from("profiles")
        .update({ name: name.trim() })
        .eq("id", user.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      toast.success("Nombre guardado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await getSupabase().auth.signOut();
      await navigate({ to: "/entrar" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo salir.");
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
            Vos
          </h1>
        </div>
        <p style={{ ...brandSubtitleStyle(FONT, "#C0BCB6"), margin: 0 }}>
          {profileQuery.data?.name ? profileQuery.data.name : "Tu perfil."}
        </p>
      </header>

      <div className="qcl-counters">
        <div className="qcl-counter">
          <strong>{quiero}</strong>
          <span>Quiero</span>
        </div>
        <div className="qcl-counter">
          <strong>{lei}</strong>
          <span>Leí</span>
        </div>
      </div>

      <section className="qcl-last-read">
        <h2>Último leído</h2>
        {lastRead ? (
          <p>
            <strong>{lastRead.title}</strong>
            {lastRead.author ? ` · ${lastRead.author}` : ""}
            {lastRead.read_at ? ` · ${formatDate(lastRead.read_at)}` : ""}
          </p>
        ) : (
          <p>Todavía no marcaste ningún libro como leído.</p>
        )}
      </section>

      <form className="qcl-form" onSubmit={(event) => void saveName(event)}>
        <label className="qcl-field">
          <span>Tu nombre</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
          />
        </label>
        <button type="submit" className="qcl-primary-btn" disabled={busy}>
          Guardar
        </button>
      </form>

      <button
        type="button"
        className="qcl-secondary-btn qcl-logout"
        disabled={busy}
        onClick={() => void logout()}
      >
        Salir
      </button>
    </main>
  );
}
