import { describe, expect, test } from "bun:test";
import { swapFailedCover } from "./leo-results";

describe("swapFailedCover", () => {
  const shown = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const backups = [{ id: "d" }, { id: "e" }];

  test("replaces the failed card with the next unused backup", () => {
    expect(swapFailedCover(shown, backups, "b")).toEqual({
      shown: [{ id: "a" }, { id: "d" }, { id: "c" }],
      backups: [{ id: "e" }],
    });
  });

  test("leaves the grid alone when the id is gone or no backup remains", () => {
    expect(swapFailedCover(shown, [], "b")).toEqual({ shown, backups: [] });
    expect(swapFailedCover(shown, backups, "missing")).toEqual({ shown, backups });
  });

  test("skips a backup already on the grid", () => {
    expect(swapFailedCover(shown, [{ id: "a" }, { id: "e" }], "c")).toEqual({
      shown: [{ id: "a" }, { id: "b" }, { id: "e" }],
      backups: [{ id: "a" }],
    });
  });
});
