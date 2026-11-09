import { expect, test } from "bun:test";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

// Acceptance is an explicit run. No missing input may turn a test into a skip.
if (process.env.QCL_E1_ACCEPTANCE !== "1") throw new Error("Set QCL_E1_ACCEPTANCE=1");
const names = [
  "QCL_SUPABASE_URL", "QCL_PUBLISHABLE_KEY",
  "QCL_USER_A_ID", "QCL_USER_A_ACCESS_TOKEN", "QCL_RECORD_A_ID",
  "QCL_USER_B_ID", "QCL_USER_B_ACCESS_TOKEN", "QCL_RECORD_B_ID",
  "QCL_USER_C_ID", "QCL_USER_C_ACCESS_TOKEN", "QCL_RECORD_C_ID",
  "QCL_EXPIRY_ACCESS_TOKEN",
] as const;
type Name = (typeof names)[number];
const missing = names.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Missing acceptance inputs: ${missing.join(", ")}`);
const cfg = Object.fromEntries(names.map((name) => [name, process.env[name]!])) as Record<Name, string>;
const ref = "mdytuysdombxyydqnsmj";
const origin = `https://${ref}.supabase.co`;
if (cfg.QCL_SUPABASE_URL !== origin) throw new Error("Target is not exactly QCL");
if (!cfg.QCL_PUBLISHABLE_KEY.startsWith("sb_publishable_")) {
  throw new Error("Only a publishable client key is accepted");
}
type Row = { id: string; owner_id: string; title: string };
type Account = { id: string; status: string };
type Claims = { iss?: string; sub?: string; role?: string; exp?: number; is_anonymous?: boolean };
type DeniedExpectation = { status: 401 | 403; code: string };
function claims(token: string, id: string): Claims {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Expected a user JWT");
  let value: Claims;
  try { value = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")); }
  catch { throw new Error("JWT claims are not decodable"); }
  if (value.iss !== `${origin}/auth/v1` || value.role !== "authenticated" ||
      value.sub !== id || value.is_anonymous === true || !Number.isSafeInteger(value.exp)) {
    throw new Error("JWT is not a normal QCL user token");
  }
  return value;
}
const ids = [cfg.QCL_USER_A_ID, cfg.QCL_USER_B_ID, cfg.QCL_USER_C_ID];
const records = [cfg.QCL_RECORD_A_ID, cfg.QCL_RECORD_B_ID, cfg.QCL_RECORD_C_ID];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (new Set(ids).size !== 3 || new Set(records).size !== 3 ||
    [...ids, ...records].some((id) => !uuid.test(id))) {
  throw new Error("A/B/C users and records must be distinct UUIDs");
}
for (const [token, id] of [
  [cfg.QCL_USER_A_ACCESS_TOKEN, ids[0]], [cfg.QCL_USER_B_ACCESS_TOKEN, ids[1]],
  [cfg.QCL_USER_C_ACCESS_TOKEN, ids[2]], [cfg.QCL_EXPIRY_ACCESS_TOKEN, ids[0]],
]) {
  if (claims(token, id).exp! <= Math.floor(Date.now() / 1000)) {
    throw new Error("A supplied user JWT has already expired");
  }
}
async function api(path: string, token?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("apikey", cfg.QCL_PUBLISHABLE_KEY);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.body) headers.set("content-type", "application/json");
  return fetch(`${origin}/${path}`, { ...init, headers, redirect: "error" });
}
async function json<T>(path: string, token: string): Promise<T> {
  const response = await api(path, token);
  expect(response.status).toBe(200);
  return response.json() as Promise<T>;
}
const rowPath = (id: string) => `rest/v1/e1_private_records?id=eq.${id}&select=id,owner_id,title`;
const allPath = "rest/v1/e1_private_records?select=id,owner_id,title";
const accountsPath = "rest/v1/accounts?select=id,status";
async function own(token: string, id: string): Promise<Row> {
  const rows = await json<Row[]>(rowPath(id), token);
  expect(rows).toHaveLength(1);
  return rows[0];
}
// PostgREST maps Postgres 42501 to HTTP 403 when the request role is
// authenticated, otherwise 401. Missing grants (not RLS empty results) are
 // expected to surface as { code: "42501" }. Confirm on the real QCL run.
async function denied(response: Response, expected: DeniedExpectation) {
  expect([401, 403]).toContain(expected.status);
  expect(response.status).toBe(expected.status);
  expect(response.status).toBeLessThan(500);
  expect(response.status).not.toBe(400);
  expect(response.status).not.toBe(429);
  const body = await response.json() as { code?: unknown };
  expect(body.code).toBe(expected.code);
}
async function patch(id: string, token: string, body: object) {
  return api(rowPath(id), token, {
    method: "PATCH", headers: { Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
}
async function gate(instruction: string) {
  if (!stdin.isTTY) throw new Error("Operator gate requires an interactive terminal");
  const reader = createInterface({ input: stdin, output: stdout });
  try { await reader.question(`${instruction}\nPress Enter when done: `); }
  finally { reader.close(); }
}

test("QCL identity, owner isolation, grants and restoration", async () => {
  const users = [
    [ids[0], records[0], cfg.QCL_USER_A_ACCESS_TOKEN],
    [ids[1], records[1], cfg.QCL_USER_B_ACCESS_TOKEN],
    [ids[2], records[2], cfg.QCL_USER_C_ACCESS_TOKEN],
  ] as const;
  for (const [id, record, token] of users) {
    const authUser = await json<{ id: string }>("auth/v1/user", token);
    expect(authUser.id).toBe(id); // Server verifies signature and identity.
    const account = await json<Account[]>(accountsPath, token);
    expect(account).toEqual([{ id, status: "active" }]);
    const visible = await json<Row[]>(allPath, token); // No ID filter.
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((row) => row.owner_id === id)).toBe(true);
    expect(visible.some((row) => row.id === record)).toBe(true);
    expect((await own(token, record)).owner_id).toBe(id);
  }
  const [a, b] = await Promise.all([
    own(cfg.QCL_USER_A_ACCESS_TOKEN, records[0]),
    own(cfg.QCL_USER_B_ACCESS_TOKEN, records[1]),
  ]);
  for (const [token, target, original] of [
    [cfg.QCL_USER_A_ACCESS_TOKEN, records[1], b],
    [cfg.QCL_USER_B_ACCESS_TOKEN, records[0], a],
  ] as const) {
    expect(await json<Row[]>(rowPath(target), token)).toEqual([]);
    const response = await patch(target, token, { title: `cross-${Date.now()}` });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    const ownerToken = target === records[0] ? cfg.QCL_USER_A_ACCESS_TOKEN : cfg.QCL_USER_B_ACCESS_TOKEN;
    expect(await own(ownerToken, target)).toEqual(original);
  }
  const changed = `own-${Date.now()}`;
  try {
    const response = await patch(records[0], cfg.QCL_USER_A_ACCESS_TOKEN, { title: changed });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ ...a, title: changed }]);
    expect(await own(cfg.QCL_USER_A_ACCESS_TOKEN, records[0])).toEqual({ ...a, title: changed });
  } finally {
    const restored = await patch(records[0], cfg.QCL_USER_A_ACCESS_TOKEN, { title: a.title });
    expect(restored.status).toBe(200);
    expect(await restored.json()).toEqual([a]);
    expect(await own(cfg.QCL_USER_A_ACCESS_TOKEN, records[0])).toEqual(a);
  }
  // Authenticated denials from missing grants (not RLS row filters).
  const grantDenied: DeniedExpectation = { status: 403, code: "42501" };
  for (const [token, ownId, ownUserId, otherId] of [
    [cfg.QCL_USER_A_ACCESS_TOKEN, records[0], ids[0], ids[1]],
    [cfg.QCL_USER_B_ACCESS_TOKEN, records[1], ids[1], ids[0]],
  ]) {
    // UPDATE(title) only — owner_id is not granted.
    await denied(await patch(ownId, token, { owner_id: otherId }), grantDenied);
    // Unfiltered accounts PATCH has no WHERE clause: PostgREST returns 400/21000
    // and must not change rows. The missing UPDATE grant is asserted with a filter.
    const unfilteredAccounts = await api(accountsPath, token, {
      method: "PATCH", body: JSON.stringify({ status: "deletion_pending" }),
    });
    expect(unfilteredAccounts.status).toBe(400);
    expect((await unfilteredAccounts.json() as { code?: unknown }).code).toBe("21000");
    expect(await json<Account[]>(accountsPath, token))
      .toEqual([{ id: ownUserId, status: "active" }]);
    // accounts: SELECT only; no UPDATE grant.
    await denied(await api(`rest/v1/accounts?id=eq.${ownUserId}&select=id,status`, token, {
      method: "PATCH", body: JSON.stringify({ status: "deletion_pending" }),
    }), grantDenied);
    // e1_private_records: no DELETE grant.
    await denied(await api(rowPath(ownId), token, { method: "DELETE" }), grantDenied);
    // e1_private_records: no INSERT grant.
    await denied(await api("rest/v1/e1_private_records", token, {
      method: "POST", body: JSON.stringify({ owner_id: otherId, title: "forged" }),
    }), grantDenied);
  }
  expect(await own(cfg.QCL_USER_A_ACCESS_TOKEN, records[0])).toEqual(a);
  expect(await own(cfg.QCL_USER_B_ACCESS_TOKEN, records[1])).toEqual(b);
  expect(await json<Account[]>(accountsPath, cfg.QCL_USER_A_ACCESS_TOKEN))
    .toEqual([{ id: ids[0], status: "active" }]);
  expect(await json<Account[]>(accountsPath, cfg.QCL_USER_B_ACCESS_TOKEN))
    .toEqual([{ id: ids[1], status: "active" }]);
  // Anon role (no JWT): PostgREST maps 42501 to 401 when unauthenticated.
  const anonDenied: DeniedExpectation = { status: 401, code: "42501" };
  await denied(await api(allPath), anonDenied);
  await denied(await api(rowPath(records[0]), undefined, {
    method: "PATCH", body: JSON.stringify({ title: "anonymous" }),
  }), anonDenied);
  expect(await own(cfg.QCL_USER_A_ACCESS_TOKEN, records[0])).toEqual(a);
});

test("same signed JWT works before expiry and gets 401 afterward", async () => {
  const token = cfg.QCL_EXPIRY_ACCESS_TOKEN;
  const expiry = claims(token, ids[0]).exp! * 1000;
  const remaining = expiry - Date.now();
  if (remaining < 5_000 || remaining > 120_000) {
    throw new Error("Expiry JWT must have 5 to 120 seconds remaining at this phase");
  }
  expect((await json<{ id: string }>("auth/v1/user", token)).id).toBe(ids[0]);
  expect((await own(token, records[0])).owner_id).toBe(ids[0]);
  await Bun.sleep(Math.max(0, expiry + 2_000 - Date.now()));
  const response = await api(rowPath(records[0]), token);
  expect(response.status).toBe(401);
}, 150_000);

test("same active C token loses read/write on deletion_pending", async () => {
  const token = cfg.QCL_USER_C_ACCESS_TOKEN;
  const id = ids[2];
  const record = records[2];
  const original = await own(token, record);
  expect(await json<Account[]>(accountsPath, token)).toEqual([{ id, status: "active" }]);
  try {
    const activeWrite = await patch(record, token, { title: `active-${Date.now()}` });
    expect(activeWrite.status).toBe(200);
    const changed = await activeWrite.json() as Row[];
    expect(changed).toHaveLength(1);
    expect(changed[0].id).toBe(record);
    expect((await own(token, record)).title).toBe(changed[0].title);
  } finally {
    const restored = await patch(record, token, { title: original.title });
    expect(restored.status).toBe(200);
    expect(await restored.json()).toEqual([original]);
    expect(await own(token, record)).toEqual(original);
  }
  if (claims(token, id).exp! * 1000 - Date.now() < 180_000) {
    throw new Error("C JWT needs at least 3 minutes for the operator transitions");
  }
  await gate("Operator: run reviewed transition SQL for C to deletion_pending");
  // Any failure after the pending gate must still restore C to active.
  try {
    if (claims(token, id).exp! * 1000 <= Date.now() + 10_000) {
      throw new Error("C JWT expired during the pending-state test");
    }
    expect((await json<{ id: string }>("auth/v1/user", token)).id).toBe(id);
    expect(await json<Account[]>(accountsPath, token)).toEqual([]);
    expect(await json<Row[]>(allPath, token)).toEqual([]);
    const blocked = await patch(record, token, { title: `pending-${Date.now()}` });
    expect(blocked.status).toBe(200);
    expect(await blocked.json()).toEqual([]);
  } finally {
    await gate("Operator: run reviewed transition SQL for C back to active");
    if (claims(token, id).exp! * 1000 <= Date.now()) {
      throw new Error("C JWT expired before restoration readback");
    }
    expect(await json<Account[]>(accountsPath, token)).toEqual([{ id, status: "active" }]);
    expect(await own(token, record)).toEqual(original); // Same token; row unchanged.
  }
}, 600_000);
