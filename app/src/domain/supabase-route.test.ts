import { expect, test } from "bun:test";
import { firstPartySupabaseUrl, proxiesSupabasePath, SUPABASE_ORIGIN } from "./supabase-route";

test("JWT calls go through the worker, sign-in and refresh stay direct", () => {
  expect(
    firstPartySupabaseUrl(
      `${SUPABASE_ORIGIN}/rest/v1/books?select=*&owner_id=eq.x&order=created_at.desc%2Cid.desc`,
    ),
  ).toBe("/sb/rest/v1/books?select=*&owner_id=eq.x&order=created_at.desc%2Cid.desc");
  expect(firstPartySupabaseUrl(`${SUPABASE_ORIGIN}/rest/v1/rpc/most_read_books`)).toBe(
    "/sb/rest/v1/rpc/most_read_books",
  );
  expect(firstPartySupabaseUrl(`${SUPABASE_ORIGIN}/auth/v1/user`)).toBe("/sb/auth/v1/user");
  expect(firstPartySupabaseUrl(`${SUPABASE_ORIGIN}/auth/v1/logout?scope=local`)).toBe(
    "/sb/auth/v1/logout?scope=local",
  );
  expect(firstPartySupabaseUrl(`${SUPABASE_ORIGIN}/auth/v1/token?grant_type=password`)).toBeNull();
  expect(firstPartySupabaseUrl(`${SUPABASE_ORIGIN}/auth/v1/signup`)).toBeNull();
  expect(firstPartySupabaseUrl("https://evil.example/rest/v1/books")).toBeNull();
  expect(firstPartySupabaseUrl(`${SUPABASE_ORIGIN}.evil.example/rest/v1/books`)).toBeNull();
  expect(proxiesSupabasePath("/storage/v1/object")).toBe(false);
});
