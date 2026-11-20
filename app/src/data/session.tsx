import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { browserSupabase } from "./supabase";
import { updateSessionUser } from "./session-epoch";
import { SessionContext, type SessionState } from "./session-context";
import { onSessionLost } from "./auth-guard";

const RECOVERY_WINDOW_MS = 30_000;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    loading: true,
    user: null,
    passwordRecovery: false,
  });
  const queryClient = useQueryClient();
  useEffect(() => {
    let alive = true;
    let authEvents = 0;
    const client = browserSupabase();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      authEvents++;
      setState((previous) => {
        if (previous.user?.id !== (session?.user.id ?? null)) queryClient.clear();
        updateSessionUser(session?.user.id ?? null);
        return {
          loading: false,
          user: session?.user ?? null,
          passwordRecovery:
            event === "PASSWORD_RECOVERY" || (event !== "SIGNED_OUT" && previous.passwordRecovery),
        };
      });
    });
    const requestVersion = authEvents;
    void client.auth.getUser().then(({ data, error }) => {
      if (!alive || authEvents !== requestVersion) return;
      if (error) {
        updateSessionUser(null);
        setState({ loading: false, user: null, passwordRecovery: false });
        return;
      }
      setState((previous) => {
        if (previous.user?.id !== (data.user?.id ?? null)) queryClient.clear();
        updateSessionUser(data.user?.id ?? null);
        return {
          loading: false,
          user: data.user,
          passwordRecovery: previous.passwordRecovery,
        };
      });
    });
    /* A user call answered 401: the client lost its session behind the UI.
       Refresh once; if there is nothing to refresh, sign out locally so the
       Gate sends the user to Entrar instead of a dead "No pudimos cargar". */
    let recovering = false;
    /* A second 401 right after a refresh means refreshing does not help. */
    let refreshedAt = 0;
    const stopListening = onSessionLost(() => {
      if (recovering) return;
      recovering = true;
      void (async () => {
        const again = Date.now() - refreshedAt < RECOVERY_WINDOW_MS;
        const { data } = again
          ? { data: { session: null } }
          : await client.auth.refreshSession();
        if (!alive) return;
        if (data.session) {
          refreshedAt = Date.now();
          /* Not awaited: the refetch must run outside `recovering`, or a 401
             it gets is dropped and the page stays on "No pudimos cargar". */
          void queryClient.invalidateQueries();
        } else {
          await client.auth.signOut({ scope: "local" }).catch(() => undefined);
          if (!alive) return;
          updateSessionUser(null);
          queryClient.clear();
          setState({ loading: false, user: null, passwordRecovery: false });
        }
      })().finally(() => {
        recovering = false;
      });
    });
    return () => {
      alive = false;
      stopListening();
      subscription.unsubscribe();
    };
  }, [queryClient]);
  const value = useMemo(() => state, [state]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
