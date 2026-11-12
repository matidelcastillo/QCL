import { browserSupabase } from "./supabase";

export async function signOut() {
  const { error } = await browserSupabase().auth.signOut();
  if (error) throw error;
}
