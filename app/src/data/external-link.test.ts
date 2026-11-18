import { describe, expect, test } from "bun:test";
import { allowedExternalUrl, buyUrl, mercadoLibreSearch } from "./external-link";

describe("external buy links", () => {
  test("allows Mercado Libre and a Google buy link, rejects anything else", () => {
    expect(allowedExternalUrl("https://listado.mercadolibre.com.ar/9780307705501")?.host).toBe(
      "listado.mercadolibre.com.ar",
    );
    expect(allowedExternalUrl("https://books.google.com.ar/books?id=x")?.host).toBe("books.google.com.ar");
    expect(allowedExternalUrl("https://evil.com")).toBeNull();
    expect(allowedExternalUrl("javascript:alert(1)")).toBeNull();
    expect(allowedExternalUrl("http://listado.mercadolibre.com.ar/x")).toBeNull();
  });

  test("falls back to Mercado Libre by ISBN when there is no buy link", () => {
    expect(buyUrl(null, "9780307705501")?.toString()).toBe(mercadoLibreSearch("9780307705501"));
    expect(buyUrl("https://evil.com/buy", "9780307705501")?.host).toBe("listado.mercadolibre.com.ar");
    expect(buyUrl(null, null)).toBeNull();
  });
});
