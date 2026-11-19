import { expect, test } from "bun:test";
import { checked, isSessionLost, onSessionLost } from "./auth-guard";
import { storedSessionShape } from "./auth-diag";

test("a PostgREST 401 is a lost session, reported once per call", () => {
  let lost = 0;
  const stop = onSessionLost(() => void lost++);
  try {
    expect(() => checked({ data: null, error: { code: "42501" }, status: 401 })).toThrow(
      "session_lost",
    );
    try {
      checked({ data: null, error: null, status: 401 });
    } catch (error) {
      expect(isSessionLost(error)).toBe(true);
    }
    expect(lost).toBe(2);
  } finally {
    stop();
  }
});

test("other results pass through or throw their own error", () => {
  expect(checked({ data: [1], error: null, status: 200 })).toEqual([1]);
  const failure = { code: "23505" };
  expect(() => checked({ data: null, error: failure, status: 409 })).toThrow();
  try {
    checked({ data: null, error: failure, status: 409 });
  } catch (error) {
    expect(error).toBe(failure);
    expect(isSessionLost(error)).toBe(false);
  }
});

test("the auth diagnostic only reads whether a session is stored and expired", () => {
  const key = "sb-mdytuysdombxyydqnsmj-auth-token";
  const store = (value: string | null) => ({ getItem: (k: string) => (k === key ? value : null) });
  expect(storedSessionShape(null)).toEqual({ stored: false, storedExpired: null });
  expect(storedSessionShape(store(null))).toEqual({ stored: false, storedExpired: null });
  expect(storedSessionShape(store(JSON.stringify({ expires_at: 10 })), 20_000)).toEqual({
    stored: true,
    storedExpired: true,
  });
  expect(storedSessionShape(store(JSON.stringify({ expires_at: 30 })), 20_000)).toEqual({
    stored: true,
    storedExpired: false,
  });
  expect(storedSessionShape(store("{bad"))).toEqual({ stored: false, storedExpired: null });
});
