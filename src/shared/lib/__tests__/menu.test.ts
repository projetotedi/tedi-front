import { describe, expect, it } from "vitest";

import { PERMISSIONS_BY_ROLE } from "@modules/auth/__tests__/fixtures/permissions";

import {
  filterMenuByPermission,
  findActiveMenuItem,
  groupMenuItems,
  isMenuGroupId,
  MENU_GROUP_IDS,
  type MenuGroup,
  type MenuItem,
} from "../menu";
import type { PermissionSubject } from "../permissions";
import { Role } from "../role";

const items: MenuItem[] = [
  {
    label: "common:nav.courses",
    path: "/courses",
    permission: "catalog.view",
    group: "catalog",
  },
  {
    label: "common:nav.hours",
    path: "/hours",
    permission: "hours.viewOthers",
    group: "hours",
  },
  {
    label: "auth:access.title",
    path: "/access",
    permission: "access.manage",
    group: "people",
  },
];

const groups: MenuGroup[] = [
  { id: "catalog", label: "common:nav.groups.catalog", icon: "catalog.svg" },
  { id: "classes", label: "common:nav.groups.classes", icon: "classes.svg" },
  { id: "lessons", label: "common:nav.groups.lessons", icon: "lessons.svg" },
  { id: "people", label: "common:nav.groups.people", icon: "people.svg" },
  { id: "hours", label: "common:nav.groups.hours", icon: "hours.svg" },
];

const paths = (result: MenuItem[]) => result.map((item) => item.path);

/** Os grupos de `groupMenuItems` como `[id, caminhos dos itens]`. */
const outline = (items: readonly MenuItem[], from: readonly MenuGroup[] = groups) =>
  groupMenuItems(items, from).map((section) => [section.group.id, paths(section.items)]);

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

describe("groupMenuItems", () => {
  it("groups items by group in the groups order", () => {
    const sections = groupMenuItems(
      [
        {
          label: "common:nav.students",
          path: "/students",
          permission: "students.view",
          group: "people",
        },
        {
          label: "common:nav.courses",
          path: "/courses",
          permission: "catalog.view",
          group: "catalog",
        },
      ],
      groups,
    );

    expect(sections.map((section) => section.group.id)).toEqual(["catalog", "people"]);
    expect(sections.map((section) => section.group.label)).toEqual([
      "common:nav.groups.catalog",
      "common:nav.groups.people",
    ]);
    expect(sections.map((section) => paths(section.items))).toEqual([["/courses"], ["/students"]]);
  });

  it("drops groups without visible items", () => {
    expect(outline(filterMenuByPermission(items, userOf(Role.member)))).toEqual([
      ["catalog", ["/courses"]],
    ]);
    expect(outline(filterMenuByPermission(items, userOf(Role.director)))).toEqual([
      ["catalog", ["/courses"]],
      ["hours", ["/hours"]],
    ]);
    expect(outline([])).toEqual([]);
  });

  it("keeps the item order within a group", () => {
    const lessons: MenuItem[] = [
      {
        label: "common:nav.calendar",
        path: "/lessons/calendar",
        permission: "lessons.view",
        group: "lessons",
      },
      {
        label: "common:nav.lessons",
        path: "/lessons",
        permission: "lessons.view",
        group: "lessons",
      },
    ];

    expect(outline(lessons)).toEqual([["lessons", ["/lessons/calendar", "/lessons"]]]);
    expect(outline([...lessons].reverse())).toEqual([
      ["lessons", ["/lessons", "/lessons/calendar"]],
    ]);
  });

  it("follows the order of the groups, not the order of the items", () => {
    expect(outline(items).map(([id]) => id)).toEqual(["catalog", "people", "hours"]);
    expect(outline(items, [...groups].reverse()).map(([id]) => id)).toEqual([
      "hours",
      "people",
      "catalog",
    ]);
  });

  it("ignores items whose group is not listed", () => {
    expect(
      outline(
        items,
        groups.filter((group) => group.id !== "people"),
      ),
    ).toEqual([
      ["catalog", ["/courses"]],
      ["hours", ["/hours"]],
    ]);
  });

  it("does not mutate the input", () => {
    const copy = [...items];

    groupMenuItems(items, groups);

    expect(items).toEqual(copy);
  });
});

describe("findActiveMenuItem", () => {
  const menu: MenuItem[] = [
    { label: "common:nav.classes", path: "/classes", permission: "classes.view", group: "classes" },
    { label: "common:nav.lessons", path: "/lessons", permission: "lessons.view", group: "lessons" },
    {
      label: "common:nav.calendar",
      path: "/lessons/calendar",
      permission: "lessons.view",
      group: "lessons",
    },
  ];

  it("finds Calendário on /lessons/calendar", () => {
    expect(findActiveMenuItem(menu, "/lessons/calendar")).toBe(menu[2]);
  });

  it("finds the parent item on a nested route", () => {
    expect(findActiveMenuItem(menu, "/classes/abc")).toBe(menu[0]);
    expect(findActiveMenuItem(menu, "/lessons")).toBe(menu[1]);
  });

  it("returns null on /profile", () => {
    expect(findActiveMenuItem(menu, "/profile")).toBeNull();
    expect(findActiveMenuItem([], "/classes")).toBeNull();
  });
});

describe("isMenuGroupId", () => {
  it("accepts every known group", () => {
    for (const id of MENU_GROUP_IDS) {
      expect(isMenuGroupId(id)).toBe(true);
    }
  });

  it("rejects unknown values", () => {
    for (const value of ["", "Catalog", "settings", 0, null, undefined, ["catalog"], {}]) {
      expect(isMenuGroupId(value)).toBe(false);
    }
  });
});
