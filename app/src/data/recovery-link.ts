/* Recovery arrives as a PKCE ?code=, an implicit hash type=recovery,
   or a token_hash OTP link. detectSessionInUrl on the supabase-js client
   (default PKCE) exchanges it and emits PASSWORD_RECOVERY. */
export function isRecoveryLink(url: string): boolean {
  const parsed = new URL(url, "https://qcl.matidelcastillo.workers.dev");
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  return (
    parsed.searchParams.has("code") ||
    parsed.searchParams.get("type") === "recovery" ||
    hash.get("type") === "recovery"
  );
}
