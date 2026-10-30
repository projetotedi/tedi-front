import { describe, expect, it } from "vitest";

import { Role } from "@shared/lib/role";

import { INVITABLE_ROLES, roleBadgeTone, toAssignableRole } from "../lib/role-label";

describe("roleBadgeTone", () => {
  it("uses the neutral tone for member and for no role", () => {
    expect(roleBadgeTone(Role.member)).toBe("neutral");
    expect(roleBadgeTone(null)).toBe("neutral");
  });

  it("uses the info tone for director", () => {
    expect(roleBadgeTone(Role.director)).toBe("info");
  });

  it("uses the highlight tone for coordinator and, since it shows as one, for superadmin", () => {
    expect(roleBadgeTone(Role.coordinator)).toBe("highlight");
    expect(roleBadgeTone(Role.superadmin)).toBe("highlight");
  });
});

describe("INVITABLE_ROLES", () => {
  it("offers member, director and coordinator, and never superadmin", () => {
    expect(INVITABLE_ROLES).toEqual([Role.member, Role.director, Role.coordinator]);
    expect(INVITABLE_ROLES).not.toContain(Role.superadmin);
  });
});

describe("toAssignableRole", () => {
  it("returns member, director and coordinator as they are", () => {
    expect(toAssignableRole(Role.member)).toBe(Role.member);
    expect(toAssignableRole(Role.director)).toBe(Role.director);
    expect(toAssignableRole(Role.coordinator)).toBe(Role.coordinator);
  });

  it("superadmin and null have no assignable role", () => {
    expect(toAssignableRole(Role.superadmin)).toBeNull();
    expect(toAssignableRole(null)).toBeNull();
  });
});
