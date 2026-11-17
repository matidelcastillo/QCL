import { describe, expect, test } from "bun:test";
import { ADD_TABS, nextScanGeneration, shouldAcceptScan } from "./add-tabs";

describe("add tabs", () => {
  test("uses the same period labels as home filters", () => {
    expect(ADD_TABS).toEqual([
      ["buscar", "Buscar."],
      ["escanear", "Escanear."],
    ]);
  });

  test("leaving Escanear bumps the scan generation", () => {
    expect(nextScanGeneration("escanear", "buscar", 3)).toBe(4);
    expect(nextScanGeneration("buscar", "escanear", 3)).toBe(3);
    expect(nextScanGeneration("buscar", "buscar", 3)).toBe(3);
    expect(nextScanGeneration("escanear", "escanear", 3)).toBe(3);
  });

  test("a catalog result from a previous scan generation is ignored", () => {
    const started = 2;
    const current = nextScanGeneration("escanear", "buscar", started);
    expect(shouldAcceptScan(started, current)).toBe(false);
    expect(shouldAcceptScan(current, current)).toBe(true);
  });
});
