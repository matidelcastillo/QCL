import { describe, expect, test } from "bun:test";
import { authErrorMessage, NEEDS_CONFIRMATION } from "./auth-errors";

describe("auth error copy", () => {
  test("login maps invalid credentials, not generic password text", () => {
    expect(
      authErrorMessage(
        { code: "invalid_credentials", message: "Invalid login credentials" },
        "entrar",
      ),
    ).toBe("Email o contraseña incorrectos.");
    expect(authErrorMessage(new Error("Invalid login credentials"), "entrar")).toBe(
      "Email o contraseña incorrectos.",
    );
  });

  test("sign-up does not reuse the login credentials message", () => {
    expect(
      authErrorMessage(
        { code: "weak_password", message: "Password should be at least 8 characters" },
        "crear",
      ),
    ).toBe("Elegí una contraseña más larga.");
    expect(authErrorMessage(new Error("Password should be at least 8 characters"), "crear")).toBe(
      "Elegí una contraseña más larga.",
    );
    expect(
      authErrorMessage(
        { code: "user_already_exists", message: "User already registered" },
        "crear",
      ),
    ).toBe("Ese email ya tiene cuenta.");
    expect(authErrorMessage(new Error("User already registered"), "crear")).toBe(
      "Ese email ya tiene cuenta.",
    );
  });

  test("confirmation and rate limits share the same short copy", () => {
    expect(authErrorMessage(new Error(NEEDS_CONFIRMATION), "crear")).toBe("Revisá tu mail.");
    expect(authErrorMessage({ code: "email_not_confirmed" }, "entrar")).toBe("Revisá tu mail.");
    expect(authErrorMessage({ code: "over_email_send_rate_limit" }, "reset")).toBe(
      "Demasiados intentos. Probá en un rato.",
    );
  });
});
