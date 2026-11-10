import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../../src/styles.css", import.meta.url), "utf8");
const header = readFileSync(
  new URL("../../src/lib/brand-header-style.ts", import.meta.url),
  "utf8",
);

describe("visual base copied from QC", () => {
  test("canonical color tokens match the source theme block", () => {
    expect(css).toContain("--bg: #f5f0eb;");
    expect(css).toContain("--black: #0a0a0a;");
    expect(css).toContain("--white: #ffffff;");
    expect(css).toContain("--gray-light: #e8e3dc;");
    expect(css).toContain("--gray-text: #6b6560;");
    expect(css).toContain("#e8624a");
  });

  test("type, width, glass, press, and nav patterns are present", () => {
    expect(css).toContain('"Plus Jakarta Sans"');
    expect(css).toContain("--app-viewport-max: 430px;");
    expect(css).toContain("--nav-hit-size: 44px;");
    expect(css).toContain("--press-card-scale: 0.985;");
    expect(css).toContain(".glass {");
    expect(css).toContain(".qc-press-card");
    expect(css).toContain(".app-bottom-nav");
    expect(css).toContain(".drawer-surface");
    expect(css).toContain(".qc-filter-tab");
  });

  test("header padding stays the source value", () => {
    expect(header).toContain('export const BRAND_HEADER_PADDING = "24px 20px 20px"');
  });
});
