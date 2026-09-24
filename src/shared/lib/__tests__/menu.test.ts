import { describe, expect, it } from "vitest";

import { filterMenuByRole, type MenuItem } from "../menu";
import { Role } from "../role";

const items: MenuItem[] = [
  { label: "common:nav.courses", path: "/courses", minRole: Role.member, icon: "courses.svg" },
  { label: "common:nav.members", path: "/members", minRole: Role.director, icon: "members.svg" },
  { label: "auth:access.title", path: "/access", minRole: Role.coordinator, icon: "access.svg" },
];

const paths = (result: MenuItem[]) => result.map((item) => item.path);

describe("filterMenuByRole", () => {
  it("keeps only the items the role satisfies", () => {
    expect(paths(filterMenuByRole(items, Role.member))).toEqual(["/courses"]);
    expect(paths(filterMenuByRole(items, Role.director))).toEqual(["/courses", "/members"]);
  });

  it("shows every item to the coordinator", () => {
    expect(paths(filterMenuByRole(items, Role.coordinator))).toEqual([
      "/courses",
      "/members",
      "/access",
    ]);
  });

  it("shows every item to the superadmin", () => {
    expect(filterMenuByRole(items, Role.superadmin)).toHaveLength(items.length);
  });

  it("returns nothing without a role", () => {
    expect(filterMenuByRole(items, null)).toEqual([]);
    expect(filterMenuByRole(items, undefined)).toEqual([]);
  });

  it("keeps the original order", () => {
    const reversed = [...items].reverse();

    expect(paths(filterMenuByRole(reversed, Role.coordinator))).toEqual([
      "/access",
      "/members",
      "/courses",
    ]);
  });

  it("does not mutate the input", () => {
    const copy = [...items];

    filterMenuByRole(items, Role.member);

    expect(items).toEqual(copy);
  });
});
