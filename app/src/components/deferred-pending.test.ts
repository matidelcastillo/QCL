import { describe, expect, test } from "bun:test";
import { nextDeferredPending } from "./deferred-pending";

describe("nextDeferredPending", () => {
  test("does not show a skeleton until the delay has passed", () => {
    expect(nextDeferredPending(true, false, null, 0, 150, 150)).toEqual({
      visible: false,
      shownAt: null,
      delay: 150,
    });
  });

  test("a fast load never shows a skeleton", () => {
    expect(nextDeferredPending(false, false, null, 80, 150, 150)).toEqual({
      visible: false,
      shownAt: null,
      delay: null,
    });
  });

  test("keeps a visible skeleton until the minimum time has passed", () => {
    expect(nextDeferredPending(false, true, 150, 200, 150, 150)).toEqual({
      visible: true,
      shownAt: 150,
      delay: 100,
    });
    expect(nextDeferredPending(false, true, 150, 300, 150, 150)).toEqual({
      visible: false,
      shownAt: null,
      delay: null,
    });
  });

  test("stays visible while still pending", () => {
    expect(nextDeferredPending(true, true, 150, 400, 150, 150)).toEqual({
      visible: true,
      shownAt: 150,
      delay: null,
    });
  });
});
