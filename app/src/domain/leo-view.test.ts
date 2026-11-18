import { describe, expect, test } from "bun:test";

const vos = await Bun.file(new URL("../routes/vos.tsx", import.meta.url)).text();
const leo = await Bun.file(new URL("../routes/leo.tsx", import.meta.url)).text();
const sheet = await Bun.file(new URL("../components/book-sheet.tsx", import.meta.url)).text();

describe("Qué leo UI", () => {
  test("Perfil has the FAB, the 2-column actions, and never says QCL", () => {
    expect(vos).toContain('aria-label="Qué leo"');
    expect(vos).toContain("leo-fab");
    expect(vos).toContain("action-grid");
    expect(vos).toContain("page-pb-fab");
    expect(vos).not.toMatch(/\bQCL\b/);
  });

  test("the flow uses stacked options, deferred tiles, and a 6-up grid", () => {
    expect(leo).toContain("chip-stack");
    expect(leo).toContain("LoadingTiles");
    expect(leo).toContain("useDeferredPending");
    expect(leo).toContain("leo-grid");
    expect(leo).toContain("swapFailedCover");
    expect(leo).toContain("onCover");
    expect(leo).toContain("Saltar");
    expect(leo).toContain('to: "/vos"');
    expect(leo).not.toMatch(/\bQCL\b/);
  });

  test("the sheet offers Comprar and hides Quiero when the book is already in Quiero", () => {
    expect(sheet).toContain("Comprar");
    expect(sheet).toContain("En tu Quiero.");
    expect(sheet).toContain("alreadyWant");
    expect(sheet).toContain("{!alreadyWant && (");
  });
});
