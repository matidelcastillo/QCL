import { describe, expect, test } from "bun:test";
import { LEO_ENABLED, LEO_STEPS, parseLeoAnswers, recentRead } from "./leo";

describe("leo steps", () => {
  test("Qué leo is off until the product flag is turned back on", () => {
    expect(LEO_ENABLED).toBe(false);
  });

  test("copy is the five questions, each with Da igual or Saltar", () => {
    expect(LEO_STEPS.map((step) => step.title)).toEqual([
      "¿Para qué?",
      "¿Qué te pinta?",
      "¿De qué?",
      "¿Rápido o lento?",
      "¿Como alguno?",
    ]);
    for (const step of LEO_STEPS.slice(0, 4)) {
      expect("options" in step && step.options.at(-1)?.[1]).toBe("Da igual.");
    }
  });

  test("parseLeoAnswers keeps a valid body and rejects a bad one", () => {
    const answers = parseLeoAnswers({
      purpose: "escaparme",
      mood: "oscuro",
      topic: "policial",
      pace: "vuele",
      anchor: { title: " Rayuela ", author: "Cortázar", page_count: 746 },
    });
    expect(answers?.purpose).toBe("escaparme");
    expect(answers?.anchor?.title).toBe("Rayuela");
    expect(answers?.anchor?.page_count).toBe(746);
    expect(
      parseLeoAnswers({ purpose: "escaparme", mood: "oscuro", topic: "policial", pace: "ya" }),
    ).toBeNull();
    expect(
      parseLeoAnswers({
        purpose: "escaparme",
        mood: "oscuro",
        topic: "policial",
        pace: "vuele",
        anchor: {},
      }),
    ).toBeNull();
  });

  test("recentRead keeps a few of the latest Leí books", () => {
    const books = [
      { status: "lei", read_at: "2026-01-01", created_at: "2026-01-01", title: "A" },
      { status: "quiero", read_at: null, created_at: "2026-06-01", title: "B" },
      { status: "lei", read_at: "2026-11-01", created_at: "2026-11-01", title: "C" },
    ];
    expect(recentRead(books, 1).map((book) => book.title)).toEqual(["C"]);
    const many = Array.from({ length: 6 }, (_, index) => ({
      status: "lei" as const,
      read_at: `2026-0${index + 1}-01`,
      title: String(index),
    }));
    expect(recentRead(many)).toHaveLength(3);
  });
});
