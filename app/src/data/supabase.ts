import { createClient } from "@supabase/supabase-js";
import { firstPartySupabaseUrl } from "../domain/supabase-route";
import { isNativeShell } from "./api-base";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (url && new URL(url).hostname !== "mdytuysdombxyydqnsmj.supabase.co") {
  throw new Error("El destino Supabase no es QCL.");
}

/* JWT-carrying calls go through the worker's same-origin /sb route; see
   domain/supabase-route.ts. The bundled App Store UI (capacitor://) and
   server code keep calling Supabase directly. */
export function firstPartyFetch(input: RequestInfo | URL, init?: RequestInit) {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : null;
  const routed =
    href && typeof window !== "undefined" && !isNativeShell() ? firstPartySupabaseUrl(href) : null;
  return fetch(routed ?? input, init);
}

export function supabase() {
  if (!url || !key) throw new Error("Falta la configuración pública de Supabase.");
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    /* Bun types add fetch.preconnect; supabase-js only calls it. */
    global: { fetch: firstPartyFetch as typeof fetch },
  });
}

let browserClient: ReturnType<typeof supabase> | null = null;
export function browserSupabase() {
  if (!browserClient) browserClient = supabase();
  return browserClient;
}
