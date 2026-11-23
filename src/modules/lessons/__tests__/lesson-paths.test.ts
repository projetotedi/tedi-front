import { describe, expect, it } from "vitest";

import { lessonDetailPath } from "../lib/lesson-paths";
import { LESSON_ID } from "./handlers";

describe("lessonDetailPath", () => {
  it("is /lessons/<id>", () => {
    expect(lessonDetailPath(LESSON_ID)).toBe(`/lessons/${LESSON_ID}`);
  });
});
