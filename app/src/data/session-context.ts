import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";

export type SessionState = { loading: boolean; user: User | null; passwordRecovery: boolean };
export const SessionContext = createContext<SessionState>({
  loading: true,
  user: null,
  passwordRecovery: false,
});

export function useSession() {
  return useContext(SessionContext);
}
