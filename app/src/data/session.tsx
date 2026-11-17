import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { browserSupabase } from "./supabase";
import { updateSessionUser } from "./session-epoch";
import { SessionContext, type SessionState } from "./session-context";

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
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);
  const value = useMemo(() => state, [state]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
