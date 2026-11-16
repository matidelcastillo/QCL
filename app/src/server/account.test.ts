import { expect, test } from "bun:test";
import { bearerToken, deleteCallerAccount, type AccountAdmin } from "./account";

function admin(overrides: Partial<AccountAdmin> & Pick<AccountAdmin, "getUser">): AccountAdmin & {
  books: string[];
  profiles: string[];
  users: string[];
} {
  const books: string[] = [];
  const profiles: string[] = [];
  const users: string[] = [];
  return {
    books,
    profiles,
    users,
    getUser: overrides.getUser,
    deleteBooks: overrides.deleteBooks ?? (async (id) => void books.push(id)),
    deleteProfile: overrides.deleteProfile ?? (async (id) => void profiles.push(id)),
    deleteUser: overrides.deleteUser ?? (async (id) => void users.push(id)),
  };
}

test("bearerToken only accepts a Bearer token", () => {
  expect(bearerToken(new Request("https://qcl.example/api/cuenta"))).toBeNull();
  expect(
    bearerToken(
      new Request("https://qcl.example/api/cuenta", { headers: { authorization: "Basic x" } }),
    ),
  ).toBeNull();
  expect(
    bearerToken(
      new Request("https://qcl.example/api/cuenta", { headers: { authorization: "Bearer abc" } }),
    ),
  ).toBe("abc");
});

test("deleteCallerAccount refuses a bad or missing JWT and does not delete", async () => {
  const denied = admin({ getUser: async () => null });
  const result = await deleteCallerAccount(denied, "nope");
  expect(result).toEqual({ status: 401, error: "No autorizado." });
  expect(denied.users).toEqual([]);
  expect(denied.books).toEqual([]);
});

test("deleteCallerAccount deletes only the caller’s books, profile and auth user", async () => {
  const store = admin({ getUser: async (jwt) => (jwt === "good" ? { id: "user-1" } : null) });
  expect(await deleteCallerAccount(store, "good")).toEqual({ ok: true });
  expect(store.books).toEqual(["user-1"]);
  expect(store.profiles).toEqual(["user-1"]);
  expect(store.users).toEqual(["user-1"]);
});
