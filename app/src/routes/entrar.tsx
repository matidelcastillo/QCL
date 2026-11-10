import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  BRAND_HEADER_PADDING,
  brandSubtitleStyle,
  brandTitleStyle,
} from "@/lib/brand-header-style";
import { getSupabase } from "@/lib/supabase";

const FONT = "'Plus Jakarta Sans', Helvetica, Arial, sans-serif";

export const Route = createFileRoute("/entrar")({
  component: Entrar,
});

function friendlyAuthError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("invalid login")) return "El email o la contraseña no coinciden.";
  if (text.includes("already registered") || text.includes("already been registered")) {
    return "Esa cuenta ya existe. Probá entrar.";
  }
  if (text.includes("password")) return "La contraseña es muy corta. Usá al menos 6 caracteres.";
  if (text.includes("email")) return "Revisá el email.";
  if (text.includes("rate") || text.includes("too many"))
    return "Esperá un momento y volvé a intentar.";
  return "No se pudo completar. Probá de nuevo.";
}

function Entrar() {
  const [mode, setMode] = useState<"entrar" | "crear">("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const supabase = getSupabase();
    try {
      if (mode === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          toast.error("La cuenta se creó, pero no se pudo entrar ahora.");
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error";
      toast.error(friendlyAuthError(message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="qcl-page">
      <header style={{ padding: BRAND_HEADER_PADDING, paddingLeft: 0, paddingRight: 0 }}>
        <div className="app-brand-header-row">
          <h1
            className="app-brand-title"
            style={{ ...brandTitleStyle(FONT, "#0A0A0A"), margin: 0 }}
          >
            <span style={{ color: "#E8624A" }}>qué carajo</span> <span>leer</span>
          </h1>
        </div>
        <p style={{ ...brandSubtitleStyle(FONT, "#C0BCB6"), margin: 0 }}>
          {mode === "entrar" ? "Entrá para ver tus libros." : "Creá tu cuenta con tu email."}
        </p>
      </header>

      <form className="qcl-form" onSubmit={(event) => void handleSubmit(event)}>
        {mode === "crear" ? (
          <label className="qcl-field">
            <span>Tu nombre</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
            />
          </label>
        ) : null}
        <label className="qcl-field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="qcl-field">
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "entrar" ? "current-password" : "new-password"}
            minLength={6}
            required
          />
        </label>
        <button type="submit" className="qcl-primary-btn" disabled={busy}>
          {mode === "entrar" ? "Entrar" : "Crear cuenta"}
        </button>
      </form>

      <p className="qcl-switch">
        {mode === "entrar" ? "¿No tenés cuenta?" : "¿Ya tenés cuenta?"}{" "}
        <button
          type="button"
          className="qcl-text-btn"
          onClick={() => setMode(mode === "entrar" ? "crear" : "entrar")}
        >
          {mode === "entrar" ? "Crear una" : "Entrar"}
        </button>
      </p>
    </main>
  );
}
