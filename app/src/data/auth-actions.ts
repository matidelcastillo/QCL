import { apiUrl } from "./api-base";
import { browserSupabase } from "./supabase";

export async function signOut() {
  const { error } = await browserSupabase().auth.signOut();
  if (error) throw error;
}

export async function deleteAccount() {
  const client = browserSupabase();
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("no_session");
  const response = await fetch(apiUrl("/api/cuenta"), {
    method: "POST",
    headers: { Authorization: `Bearer ${data.session.access_token}` },
  });
  if (!response.ok) throw new Error("delete_failed");
  await client.auth.signOut();
}
