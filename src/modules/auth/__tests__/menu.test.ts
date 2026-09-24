import { describe, expect, it } from "vitest";

import { Role } from "@shared/lib/role";

import { authMenuItems } from "../menu";
import { authProtectedRoutes } from "../routes";

describe("authMenuItems", () => {
  it("points every item to a declared protected route", () => {
    const declared = authProtectedRoutes.map((route) => `/${route.path}`);

    for (const item of authMenuItems) {
      expect(declared).toContain(item.path);
    }
  });

  it("shows Access only from coordinator up", () => {
    expect(authMenuItems).toContainEqual(
      expect.objectContaining({ path: "/access", minRole: Role.coordinator }),
    );
  });
});
