import { describe, expect, it } from "vitest";

import { buildLessonPlanEditPath, wantsEdit, withoutEdit } from "../lib/lesson-plan-edit-param";

describe("buildLessonPlanEditPath", () => {
  it("builds the path of the plan with edit=1", () => {
    expect(buildLessonPlanEditPath("01952ef7-0000-7000-8000-0000000000a2")).toBe(
      "/lesson-plans/01952ef7-0000-7000-8000-0000000000a2?edit=1",
    );
  });
});

describe("wantsEdit", () => {
  it("wants edit only for edit=1", () => {
    expect(wantsEdit(new URLSearchParams("edit=1"))).toBe(true);
    expect(wantsEdit(new URLSearchParams("page=2&edit=1"))).toBe(true);

    for (const search of ["edit=0", "edit=true", "edit=", "edit", "", "page=2"]) {
      expect(wantsEdit(new URLSearchParams(search)), `"${search}"`).toBe(false);
    }
  });
});

describe("withoutEdit", () => {
  it("removes edit and keeps the other parameters", () => {
    const params = new URLSearchParams("page=2&edit=1&tab=usage");

    expect(withoutEdit(params).toString()).toBe("page=2&tab=usage");
  });

  it("leaves nothing when edit was the only parameter", () => {
    expect(withoutEdit(new URLSearchParams("edit=1")).toString()).toBe("");
  });

  it("does not change the parameters it receives", () => {
    const params = new URLSearchParams("edit=1&page=2");

    const next = withoutEdit(params);

    expect(next).not.toBe(params);
    expect(params.toString()).toBe("edit=1&page=2");
  });
});
