import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { browserSupabase } from "../data/supabase";

export const Route = createFileRoute("/entrar")({ component: Enter });

function errorMessage(message: string) {
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
      if (!result.data.session) throw new Error("signup_requires_confirmation");
      await navigate({ to: "/" });
    } catch (cause) {
      setError(errorMessage(cause instanceof Error ? cause.message : ""));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page">
      <h1 className="brand">
        <span className="brand-accent">que carajo</span> leer
      </h1>
      <div className="form-stack">
        <div className="drawer-choice-dock" aria-label="Modo de acceso">
          <button
            type="button"
            className={`drawer-choice${mode === "entrar" ? " active" : ""}`}
            onClick={() => {
              setMode("entrar");
              setError("");
            }}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`drawer-choice${mode === "crear" ? " active" : ""}`}
            onClick={() => {
              setMode("crear");
              setError("");
            }}
          >
            Crear cuenta
          </button>
        </div>
        <form className="form-stack" onSubmit={(event) => void submit(event)}>
          {mode === "crear" && (
            <input
              className="qc-auth-email-input"
              type="text"
              placeholder="Nombre"
              aria-label="Nombre"
              autoComplete="name"
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
          <button type="submit" className="primary-button qc-press" disabled={busy}>
            {mode === "entrar" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>
      </div>
    </main>
  );
}
