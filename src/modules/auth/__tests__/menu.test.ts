import { describe, expect, it } from "vitest";

import { authMenuItems } from "../menu";
import { authProtectedRoutes } from "../routes";

describe("authMenuItems", () => {
  it("points every item to a declared protected route", () => {
    const declared = authProtectedRoutes.map((route) => `/${route.path}`);

    for (const item of authMenuItems) {
      expect(declared).toContain(item.path);
    }
  });

  it("shows Membros e Planejamento only with access.manage", () => {
    expect(authMenuItems).toContainEqual(
      expect.objectContaining({ path: "/members", permission: "access.manage" }),
    );
  });
});
