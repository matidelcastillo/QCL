import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://mdytuysdombxyydqnsmj.supabase.co";

export type AccountAdmin = {
  getUser: (jwt: string) => Promise<{ id: string } | null>;
  deleteBooks: (userId: string) => Promise<void>;
  deleteProfile: (userId: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
};

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function deleteCallerAccount(
  admin: AccountAdmin,
  jwt: string,
): Promise<{ ok: true } | { status: number; error: string }> {
  const user = await admin.getUser(jwt);
  if (!user) return { status: 401, error: "No autorizado." };
  await admin.deleteBooks(user.id);
  await admin.deleteProfile(user.id);
  await admin.deleteUser(user.id);
  return { ok: true };
}

export function accountAdmin(serviceRoleKey: string): AccountAdmin {
  if (new URL(SUPABASE_URL).hostname !== "mdytuysdombxyydqnsmj.supabase.co") {
    throw new Error("El destino Supabase no es QCL.");
  }
  const supabase = createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return {
    async getUser(jwt) {
      const { data, error } = await supabase.auth.getUser(jwt);
      if (error || !data.user) return null;
      return { id: data.user.id };
    },
    async deleteBooks(userId) {
      const { error } = await supabase.from("books").delete().eq("owner_id", userId);
      if (error) throw error;
    },
    async deleteProfile(userId) {
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
    },
    async deleteUser(userId) {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;
    },
  };
}
