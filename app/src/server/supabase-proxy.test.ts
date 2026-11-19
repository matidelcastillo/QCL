import { expect, test } from "bun:test";
import { SUPABASE_ORIGIN } from "../domain/supabase-route";
import { supabaseProxyResponse } from "./supabase-proxy";

const base = "https://qcl.example";
type Call = { url: string; init: RequestInit };

function recorder(response = new Response("[]", { status: 200 })) {
  const calls: Call[] = [];
  const fetcher = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return response;
  };
  return { calls, fetcher };
}

test("forwards the user's Authorization and apikey to PostgREST unchanged", async () => {
  const { calls, fetcher } = recorder(
    new Response("[]", {
      status: 200,
      headers: {
        "content-type": "application/json",
        "set-cookie": "x=1",
        "content-range": "0-0/1",
      },
    }),
  );
  const response = await supabaseProxyResponse(
    new Request(`${base}/sb/rest/v1/books?select=*&owner_id=eq.u`, {
      headers: {
        authorization: "Bearer user.jwt.token",
        apikey: "sb_publishable_x",
        "accept-profile": "public",
        cookie: "session=secret",
        "sec-fetch-site": "same-origin",
      },
    }),
    fetcher,
  );
  expect(response?.status).toBe(200);
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toBe(`${SUPABASE_ORIGIN}/rest/v1/books?select=*&owner_id=eq.u`);
  const sent = new Headers(calls[0].init.headers);
  expect(sent.get("authorization")).toBe("Bearer user.jwt.token");
  expect(sent.get("apikey")).toBe("sb_publishable_x");
  expect(sent.get("accept-profile")).toBe("public");
  expect(sent.get("cookie")).toBeNull();
  expect(calls[0].init.body).toBeUndefined();
  expect(response?.headers.get("set-cookie")).toBeNull();
  expect(response?.headers.get("content-range")).toBe("0-0/1");
  expect(response?.headers.get("cache-control")).toBe("no-store");
});

test("passes writes with their body and upstream status (a 401 stays a 401)", async () => {
  const { calls, fetcher } = recorder(new Response('{"code":"42501"}', { status: 401 }));
  const response = await supabaseProxyResponse(
    new Request(`${base}/sb/rest/v1/books`, {
      method: "POST",
      headers: {
        origin: base,
        "content-type": "application/json",
        prefer: "return=representation",
      },
      body: '{"title":"Rayuela"}',
    }),
    fetcher,
  );
  expect(response?.status).toBe(401);
  expect(new TextDecoder().decode(calls[0].init.body as ArrayBuffer)).toBe('{"title":"Rayuela"}');
  expect(new Headers(calls[0].init.headers).get("prefer")).toBe("return=representation");
});

test("only JWT paths, only same-origin pages", async () => {
  const { calls, fetcher } = recorder();
  const status = async (path: string, init: RequestInit = {}) =>
    (await supabaseProxyResponse(new Request(`${base}${path}`, init), fetcher))?.status;
  expect(await supabaseProxyResponse(new Request(`${base}/api/libros`), fetcher)).toBeNull();
  expect(await status("/sb/auth/v1/token?grant_type=password", { method: "POST" })).toBe(404);
  expect(await status("/sb/storage/v1/object/x")).toBe(404);
  expect(await status("/sb/rest/v1/books", { method: "OPTIONS" })).toBe(405);
  expect(
    await status("/sb/rest/v1/books", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    }),
  ).toBe(403);
  expect(await status("/sb/rest/v1/books", { headers: { "sec-fetch-site": "cross-site" } })).toBe(
    403,
  );
  expect(calls).toHaveLength(0);
  expect(await status("/sb/auth/v1/user", { headers: { authorization: "Bearer t" } })).toBe(200);
  expect(calls[0].url).toBe(`${SUPABASE_ORIGIN}/auth/v1/user`);
});
