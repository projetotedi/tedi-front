import { describe, expect, it } from "vitest";

import { visibleNavItems } from "@shared/lib/navigation";
import { Role } from "@shared/lib/role";

import { authNavItems } from "../navigation";

describe("authNavItems", () => {
  it("declares a single item that goes to /access", () => {
    expect(authNavItems).toHaveLength(1);
    expect(authNavItems[0]).toMatchObject({
      to: "/access",
      labelNs: "auth",
      labelKey: "nav.access",
      minRole: Role.coordinator,
    });
    expect(authNavItems[0]?.iconSrc).toEqual(expect.any(String));
  });

  it.each([Role.coordinator, Role.superadmin])("is visible to %s", (role) => {
    expect(visibleNavItems(authNavItems, role)).toEqual(authNavItems);
  });

  it.each([Role.member, Role.director])("is hidden from %s", (role) => {
    expect(visibleNavItems(authNavItems, role)).toEqual([]);
  });
});
