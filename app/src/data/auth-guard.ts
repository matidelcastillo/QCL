/* The UI can believe it is signed in while the Supabase client has no
   session (seen 2026-11-18 on desktop Safari: /user 200, then every books
   request went out with only the publishable key and PostgREST answered 401
   "permission denied for table books"). The query then showed "No pudimos
   cargar" forever. A 401 from PostgREST always means "no user JWT": it is
   reported here so SessionProvider can refresh the session or send the user
   to Entrar, instead of retrying anonymously. */
export class SessionLost extends Error {
  constructor() {
    super("session_lost");
    this.name = "SessionLost";
  }
}

export function isSessionLost(error: unknown): error is SessionLost {
  return error instanceof SessionLost;
}

type Listener = () => void;
const listeners = new Set<Listener>();

export function onSessionLost(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* PostgREST result guard for user-scoped calls. */
export function checked<T>(result: { data: T; error: unknown; status: number }): T {
  if (result.status === 401) {
    for (const listener of listeners) listener();
    throw new SessionLost();
  }
  if (result.error) throw result.error;
  return result.data;
}
