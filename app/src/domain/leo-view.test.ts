import { describe, expect, test } from "bun:test";

const vos = await Bun.file(new URL("../routes/vos.tsx", import.meta.url)).text();
const leo = await Bun.file(new URL("../routes/leo.tsx", import.meta.url)).text();
const sheet = await Bun.file(new URL("../components/book-sheet.tsx", import.meta.url)).text();

describe("Qué leo UI", () => {
  test("Perfil hides the FAB while Qué leo is off, and never says QCL", () => {
    expect(vos).toContain("LEO_ENABLED");
    expect(vos).toContain("{LEO_ENABLED && (");
    expect(vos).toContain('aria-label="Qué leo"');
    expect(vos).toContain("leo-fab");
    expect(vos).toContain("action-grid");
    expect(vos).not.toMatch(/\bQCL\b/);
  });

  test("the flow stays in the code, and /leo redirects to /vos while it is off", () => {
    expect(leo).toContain("LEO_ENABLED");
    expect(leo).toContain('redirect({ to: "/vos" })');
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
