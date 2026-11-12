import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (url && new URL(url).hostname !== "mdytuysdombxyydqnsmj.supabase.co") {
  throw new Error("El destino Supabase no es QCL.");
}

export function supabase() {
  if (!url || !key) throw new Error("Falta la configuración pública de Supabase.");
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

let browserClient: ReturnType<typeof supabase> | null = null;
export function browserSupabase() {
  if (!browserClient) browserClient = supabase();
  return browserClient;
}
