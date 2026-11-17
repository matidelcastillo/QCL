import { browserSupabase } from "./supabase";

export const PASSWORD_RESET_REDIRECT = "https://qcl.matidelcastillo.workers.dev/clave";

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

export async function requestPasswordReset(email: string) {
  const { error } = await browserSupabase().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: PASSWORD_RESET_REDIRECT,
  });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await browserSupabase().auth.updateUser({ password });
  if (error) throw error;
}
