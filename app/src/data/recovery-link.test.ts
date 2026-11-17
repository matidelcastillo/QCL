import { describe, expect, test } from "bun:test";
import { isRecoveryLink } from "./recovery-link";

describe("isRecoveryLink", () => {
  test("detects a PKCE code", () => {
    expect(isRecoveryLink("https://qcl.matidelcastillo.workers.dev/clave?code=abc")).toBe(true);
  });
  test("detects an implicit recovery hash", () => {
    expect(
      isRecoveryLink("https://qcl.matidelcastillo.workers.dev/clave#access_token=t&type=recovery"),
    ).toBe(true);
  });
  test("detects a token_hash recovery link", () => {
    expect(
      isRecoveryLink("https://qcl.matidelcastillo.workers.dev/clave?token_hash=h&type=recovery"),
    ).toBe(true);
  });
  test("rejects a normal visit", () => {
    expect(isRecoveryLink("https://qcl.matidelcastillo.workers.dev/clave")).toBe(false);
    expect(isRecoveryLink("https://qcl.matidelcastillo.workers.dev/clave?next=/")).toBe(false);
  });
});
