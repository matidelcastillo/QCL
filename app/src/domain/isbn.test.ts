import { describe, expect, test } from "bun:test";
import { isbn10, normalizeIsbn } from "./isbn";

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

test("ISBN-10 form of 978 ISBNs only", () => {
  expect(isbn10("9788471893147")).toBe("8471893142");
  expect(isbn10("9780306406157")).toBe("0306406152");
  expect(isbn10("9780804429573")).toBe("080442957X");
  expect(isbn10("9791032305690")).toBeNull();
});
