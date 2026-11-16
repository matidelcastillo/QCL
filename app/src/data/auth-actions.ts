import { browserSupabase } from "./supabase";

export async function signOut() {
  const { error } = await browserSupabase().auth.signOut();
  if (error) throw error;
}

export async function deleteAccount() {
  const client = browserSupabase();
  const { error } = await client.rpc("delete_own_account");
  if (error) throw error;
  await client.auth.signOut();
}
