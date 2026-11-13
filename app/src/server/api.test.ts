import { expect, test } from "bun:test";
import { apiResponse } from "./api";

const base = "https://qcl.example";

test("catalog rejects invalid requests before calling upstreams", async () => {
  expect((await apiResponse(new Request(`${base}/api/libros`, { method: "POST" })))?.status).toBe(
    405,
  );
  const empty = await apiResponse(new Request(`${base}/api/libros?q=`));
  expect(empty?.status).toBe(200);
  expect(await empty?.json()).toEqual({ results: [] });
  expect((await apiResponse(new Request(`${base}/api/libros?q=${"x".repeat(201)}`)))?.status).toBe(
    400,
  );
  expect((await apiResponse(new Request(`${base}/api/libros?isbn=9780000000000`)))?.status).toBe(
    400,
  );
});

test("cover endpoint refuses hosts outside the allowlist", async () => {
  expect(
    (await apiResponse(new Request(`${base}/api/tapa?u=https%3A%2F%2Fevil.example%2Fcover.jpg`)))
      ?.status,
  ).toBe(400);
});
