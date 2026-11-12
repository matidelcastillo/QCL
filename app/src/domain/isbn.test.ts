import { describe, expect, test } from "bun:test";
import { normalizeIsbn } from "./isbn";

describe("ISBN", () => {
  test("converts ISBN-10 and accepts a matching ISBN-13", () => {
    expect(normalizeIsbn("0-306-40615-2")).toBe("9780306406157");
    expect(normalizeIsbn("978-0-306-40615-7")).toBe("9780306406157");
  });
  test("rejects bad checksums and non-book EAN codes", () => {
    expect(normalizeIsbn("9780306406158")).toBeNull();
    expect(normalizeIsbn("4006381333931")).toBeNull();
    expect(normalizeIsbn("not-an-isbn")).toBeNull();
  });
});
