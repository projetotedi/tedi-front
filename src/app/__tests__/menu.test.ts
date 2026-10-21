import { describe, expect, it } from "vitest";

import { appMenuItems, prototypeMenuItems } from "../menu";
import { prototypeRoutes } from "../prototype-routes";

describe("appMenuItems", () => {
  it("keeps the order of the Figma sidebar", () => {
    expect(appMenuItems.map((item) => item.label)).toEqual([
      "common:nav.courses",
      "common:nav.lessonPlans",
      "common:nav.classes",
      "common:nav.students",
      "common:nav.lessons",
      "common:nav.enrollments",
      "common:nav.members",
      "common:nav.hours",
    ]);
  });

  it("takes Planos de aula from the catalog module, not from the prototype", () => {
    expect(prototypeMenuItems.map((item) => item.path)).not.toContain("/lesson-plans");
    expect(prototypeRoutes.map((route) => route.path)).not.toContain("lesson-plans");
    expect(appMenuItems).toContainEqual(
      expect.objectContaining({ path: "/lesson-plans", permission: "catalog.view" }),
    );
  });

  it("has no duplicated path", () => {
    const paths = appMenuItems.map((item) => item.path);

    expect(new Set(paths).size).toBe(paths.length);
  });
});
