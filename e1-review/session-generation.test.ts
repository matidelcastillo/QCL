import { expect, test } from "bun:test";
import { createSessionGeneration } from "./session-generation";

test("anonymous requests cannot publish private state", () => {
  expect(createSessionGeneration().capture()()).toBe(false);
});

test("A response arriving after B login is discarded", async () => {
  const guard = createSessionGeneration();
  guard.change("fixture-a");
  const accepted = guard.capture();
  guard.change("fixture-b");
  await Promise.resolve();
  expect(accepted()).toBe(false);
  expect(guard.capture()()).toBe(true);
});

test("A -> logout -> A invalidates the first A request", () => {
  const guard = createSessionGeneration();
  guard.change("fixture-a");
  const accepted = guard.capture();
  guard.change(null);
  guard.change("fixture-a");
  expect(accepted()).toBe(false);
});

test("session expiry invalidates in-flight results", () => {
  const guard = createSessionGeneration();
  guard.change("fixture-a");
  const accepted = guard.capture();
  guard.change(null);
  expect(accepted()).toBe(false);
});
