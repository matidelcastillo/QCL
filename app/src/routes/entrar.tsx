import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { browserSupabase } from "../data/supabase";
import { requestPasswordReset } from "../data/auth-actions";
import { authErrorMessage, NEEDS_CONFIRMATION } from "../data/auth-errors";
import { BrandHeader } from "../components/brand-header";
import { buttonClass } from "../components/button";

export const Route = createFileRoute("/entrar")({ component: Enter });

function Enter() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"entrar" | "crear">("entrar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const client = browserSupabase();
      const result =
        mode === "entrar"
          ? await client.auth.signInWithPassword({ email, password })
          : await client.auth.signUp({ email, password, options: { data: { name: name.trim() } } });
      if (result.error) throw result.error;
      if (!result.data.session) throw new Error(NEEDS_CONFIRMATION);
      await navigate({ to: "/" });
    } catch (cause) {
      setError(authErrorMessage(cause, mode));
    } finally {
      setBusy(false);
    }
  }
  async function resetPassword() {
    if (!email.trim()) {
      setError("Escribí tu email.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await requestPasswordReset(email);
      setNotice("Revisá tu mail.");
    } catch (cause) {
      setError(authErrorMessage(cause, "reset"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-screen">
      <div className="auth-panel">
        <BrandHeader heading />
        <div className="stack app-gutter">
          <div className="drawer-choice-dock" role="group" aria-label="Acceso">
            {(
              [
                ["entrar", "Entrar"],
                ["crear", "Crear cuenta"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`drawer-choice${mode === value ? " drawer-choice-active" : ""}`}
                aria-pressed={mode === value}
                onClick={() => {
                  setMode(value);
                  setError("");
                  setNotice("");
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <form className="stack" onSubmit={(event) => void submit(event)}>
            {mode === "crear" && (
              <input
                className="qc-auth-email-input"
                type="text"
                placeholder="Nombre"
                aria-label="Nombre"
                autoComplete="name"
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            )}
            <input
              className="qc-auth-email-input"
              type="email"
              placeholder="Email"
              aria-label="Email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <input
              className="qc-auth-email-input"
              type="password"
              placeholder="Contraseña"
              aria-label="Contraseña"
              autoComplete={mode === "entrar" ? "current-password" : "new-password"}
              minLength={mode === "crear" ? 8 : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="qc-feedback-text" role="status">
                {notice}
              </p>
            )}
            <button type="submit" className={buttonClass("primary", true)} disabled={busy}>
              {mode === "entrar" ? "Entrar" : "Crear cuenta"}
            </button>
          </form>
          {mode === "entrar" && (
            <button
              type="button"
              className="text-action"
              disabled={busy}
              onClick={() => void resetPassword()}
            >
              ¿Olvidaste la contraseña?
            </button>
          )}
          <Link to="/privacidad" className="text-action">
            Privacidad
          </Link>
          <Link to="/soporte" className="text-action">
            Soporte
          </Link>
        </div>
      </div>
    </main>
  );
}
