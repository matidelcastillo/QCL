import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { updatePassword } from "../data/auth-actions";
import { authErrorMessage } from "../data/auth-errors";
import { useSession } from "../data/session-context";
import { BrandHeader } from "../components/brand-header";
import { LoadingPage } from "../components/feedback";
import { buttonClass } from "../components/button";

export const Route = createFileRoute("/clave")({ component: NewPassword });

function NewPassword() {
  const { loading, user, passwordRecovery } = useSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await updatePassword(password);
      await navigate({ to: "/" });
    } catch (cause) {
      setError(authErrorMessage(cause, "reset"));
    } finally {
      setBusy(false);
    }
  }
  const form = passwordRecovery && user;
  return (
    <main className="auth-screen">
      <div className="auth-panel">
        <BrandHeader heading />
        <div className="stack app-gutter">
          {loading ? (
            <LoadingPage />
          ) : form ? (
            <form className="stack" onSubmit={(event) => void submit(event)}>
              <input
                className="qc-auth-email-input"
                type="password"
                placeholder="Nueva contraseña"
                aria-label="Nueva contraseña"
                autoComplete="new-password"
                minLength={8}
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
                Guardar
              </button>
            </form>
          ) : (
            <>
              <p className="qc-feedback-text">Abrí el enlace del mail.</p>
              <Link to="/entrar" className="text-action">
                Volver
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
