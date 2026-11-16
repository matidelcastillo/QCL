import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { browserSupabase } from "../data/supabase";
import { BrandHeader } from "../components/brand-header";
import { buttonClass } from "../components/button";

export const Route = createFileRoute("/entrar")({ component: Enter });

const NEEDS_CONFIRMATION = "signup_requires_confirmation";

function errorMessage(message: string) {
  if (message === NEEDS_CONFIRMATION) return "Revisá tu mail.";
  if (/already registered|already exists|user already/i.test(message))
    return "Ese email ya tiene cuenta.";
  if (/invalid login|invalid credentials|password/i.test(message))
    return "Email o contraseña incorrectos.";
  return "Revisá la conexión.";
}

function Enter() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"entrar" | "crear">("entrar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
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
      setError(errorMessage(cause instanceof Error ? cause.message : ""));
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
              minLength={mode === "crear" ? 6 : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className={buttonClass("primary", true)} disabled={busy}>
              {mode === "entrar" ? "Entrar" : "Crear cuenta"}
            </button>
          </form>
          <Link to="/privacidad" className="text-action">
            Privacidad
          </Link>
        </div>
      </div>
    </main>
  );
}
