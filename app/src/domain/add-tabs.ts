export type AddTab = "buscar" | "escanear";

/* Same filter-tab labels as home: word plus a period. */
export const ADD_TABS: Array<[AddTab, string]> = [
  ["buscar", "Buscar."],
  ["escanear", "Escanear."],
];

/* Leaving Escanear invalidates in-flight camera and catalog results. */
export function nextScanGeneration(from: AddTab, to: AddTab, generation: number): number {
  return from === "escanear" && to !== "escanear" ? generation + 1 : generation;
}

export function shouldAcceptScan(started: number, current: number): boolean {
  return started === current;
}
