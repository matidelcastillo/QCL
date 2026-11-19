import { apiUrl } from "./api-base";

/* TEMPORARY (2026-11-18), see docs/DECISIONS.md: when a user-scoped call
   came back 401 while signed in, log the shape of the local session to
   /api/diag. No token, no user id, no email. */
const STORAGE_KEY = "sb-mdytuysdombxyydqnsmj-auth-token";

export function storedSessionShape(storage: Pick<Storage, "getItem"> | null, now = Date.now()) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return { stored: false, storedExpired: null };
    const parsed = JSON.parse(raw) as { expires_at?: unknown };
    return {
      stored: true,
      storedExpired: typeof parsed.expires_at === "number" ? parsed.expires_at * 1000 <= now : null,
    };
  } catch {
    return { stored: false, storedExpired: null };
  }
}

export function reportAuthLoss(outcome: "refreshed" | "signed-out", refreshError: string | null) {
  if (typeof window === "undefined") return;
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  const shape = storedSessionShape(storage);
  const started = Date.now();
  void fetch(apiUrl("/api/diag"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "probe" }),
  })
    .then((response) => {
      const server = Date.parse(response.headers.get("date") ?? "");
      return Number.isFinite(server) ? Math.round((started - server) / 1000) : null;
    })
    .catch(() => null)
    .then((skew) =>
      fetch(apiUrl("/api/diag"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "auth",
          outcome,
          refreshError,
          storage: storage ? "ok" : "blocked",
          ...shape,
          skewSec: skew,
          origin: window.location.origin,
          ua: navigator.userAgent,
        }),
        keepalive: true,
      }),
    )
    .catch(() => undefined);
}
