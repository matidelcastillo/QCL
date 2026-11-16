import { describe, expect, test } from "bun:test";
import { classifyGenre, genreInput, genrePrompt, GENRE_MODEL, SUBJECT_LIMIT } from "./genre-ai";

const input = { title: "Rayuela", author: "Julio Cortázar", subjects: ["Fiction"], categories: [] };

describe("classifyGenre", () => {
  test("asks the model at temperature 0 with the fixed list and parses the label", async () => {
    const calls: unknown[] = [];
    const ai = {
      run: async (model: string, body: unknown) => {
        calls.push([model, body]);
        return { response: "Novela" };
      },
    };
    expect(await classifyGenre(ai, input)).toBe("Novela");
    const [model, body] = calls[0] as [string, { temperature: number; messages: unknown[] }];
    expect(model).toBe(GENRE_MODEL);
    expect(body.temperature).toBe(0);
    expect(genrePrompt(input)).toContain("Novela | Cuentos");
    expect(genrePrompt(input)).toContain("Google categories: (none)");
  });
  test("an answer outside the list is Otros", async () => {
    const ai = { run: async () => ({ response: "Magical realism" }) };
    expect(await classifyGenre(ai, input)).toBe("Otros");
  });
});

describe("genreInput", () => {
  test("requires a title and bounds every field", () => {
    expect(genreInput({ author: "x" })).toBeNull();
    const parsed = genreInput({
      title: "  Rayuela  ",
      subjects: Array.from({ length: 40 }, (_, i) => `s${i}`),
      categories: [1, "Fiction"],
    });
    expect(parsed?.title).toBe("Rayuela");
    expect(parsed?.subjects).toHaveLength(SUBJECT_LIMIT);
    expect(parsed?.categories).toEqual(["Fiction"]);
  });
});
