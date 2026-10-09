import { describe, expect, it } from "vitest";

import { PERMISSIONS_BY_ROLE } from "@modules/auth/__tests__/fixtures/permissions";

import { filterMenuByPermission, type MenuItem } from "../menu";
import type { PermissionSubject } from "../permissions";
import { Role } from "../role";

const items: MenuItem[] = [
  {
    label: "common:nav.courses",
    path: "/courses",
    permission: "catalog.view",
    icon: "courses.svg",
  },
  {
    label: "common:nav.hours",
    path: "/hours",
    permission: "hours.viewOthers",
    icon: "hours.svg",
  },
  {
    label: "auth:access.title",
    path: "/access",
    permission: "access.manage",
    icon: "access.svg",
  },
];

const paths = (result: MenuItem[]) => result.map((item) => item.path);

function userOf(role: Role): PermissionSubject {
  return { id: "person-1", permissions: PERMISSIONS_BY_ROLE[role] };
}

describe("filterMenuByPermission", () => {
  it("keeps only the items the user can see, in the original order", () => {
    expect(paths(filterMenuByPermission(items, userOf(Role.member)))).toEqual(["/courses"]);
    expect(paths(filterMenuByPermission(items, userOf(Role.director)))).toEqual([
      "/courses",
      "/hours",
    ]);
    expect(paths(filterMenuByPermission(items, userOf(Role.coordinator)))).toEqual([
      "/courses",
      "/hours",
      "/access",
    ]);
    expect(paths(filterMenuByPermission([...items].reverse(), userOf(Role.coordinator)))).toEqual([
      "/access",
      "/hours",
      "/courses",
    ]);
  });

  it("returns no items without a session", () => {
    expect(filterMenuByPermission(items, null)).toEqual([]);
    expect(filterMenuByPermission(items, undefined)).toEqual([]);
  });

  it("superadmin sees every item", () => {
    expect(filterMenuByPermission(items, userOf(Role.superadmin))).toHaveLength(items.length);
  });

  it("does not mutate the input", () => {
    const copy = [...items];

    filterMenuByPermission(items, userOf(Role.member));

    expect(items).toEqual(copy);
  });
});
