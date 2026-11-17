export const NEEDS_CONFIRMATION = "signup_requires_confirmation";

export type AuthMode = "entrar" | "crear" | "reset";

function errorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error ? String(error.code) : "";
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "";
}

export function authErrorMessage(error: unknown, mode: AuthMode): string {
  const code = errorCode(error);
  const message = errorText(error);
  if (message === NEEDS_CONFIRMATION || code === "email_not_confirmed") return "Revisá tu mail.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit")
    return "Demasiados intentos. Probá en un rato.";
  if (mode === "entrar") {
    if (code === "invalid_credentials" || /invalid login|invalid credentials/i.test(message))
      return "Email o contraseña incorrectos.";
    if (code === "user_banned") return "Esa cuenta está bloqueada.";
    return "Revisá la conexión.";
  }
  if (mode === "crear") {
    if (
      code === "user_already_exists" ||
      code === "email_exists" ||
      /already registered|already exists|user already/i.test(message)
    )
      return "Ese email ya tiene cuenta.";
    if (code === "weak_password" || /password/i.test(message))
      return "Elegí una contraseña más larga.";
    if (code === "email_address_invalid") return "Revisá el email.";
    return "Revisá la conexión.";
  }
  return "Revisá la conexión.";
}
