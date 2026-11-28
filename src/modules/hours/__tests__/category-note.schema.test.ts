import { describe, expect, it } from "vitest";

import { categoryNoteFormSchema, toSetNoteBody } from "../schemas/category-note.schema";

function noteError(note: string): string | undefined {
  const result = categoryNoteFormSchema.safeParse({ note });
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe("category note schema", () => {
  it("trims the note", () => {
    const values = categoryNoteFormSchema.parse({
      note: "  Ajuste de 2h por lançamento duplicado.  ",
    });

    expect(values).toEqual({ note: "Ajuste de 2h por lançamento duplicado." });
    expect(toSetNoteBody("planning", values)).toEqual({
      category: "planning",
      note: "Ajuste de 2h por lançamento duplicado.",
    });
  });

  it("keeps the line breaks inside the note", () => {
    const values = categoryNoteFormSchema.parse({ note: "\nPrimeira linha\nSegunda linha\n" });

    expect(toSetNoteBody("event", values).note).toBe("Primeira linha\nSegunda linha");
  });

  it("sends null when the note is blank", () => {
    for (const note of ["", "   ", "\n \t"]) {
      const values = categoryNoteFormSchema.parse({ note });

      expect(toSetNoteBody("lesson", values)).toEqual({ category: "lesson", note: null });
    }
  });

  it("refuses more than 500 characters with tooLong", () => {
    expect(noteError("a".repeat(501))).toBe("tooLong");
  });

  it("counts the characters after trimming, so 500 with spaces around are accepted", () => {
    expect(noteError(`  ${"a".repeat(500)}  `)).toBeUndefined();
  });

  it("accepts exactly 500 characters", () => {
    expect(noteError("a".repeat(500))).toBeUndefined();
  });
});
