import { describe, expect, it } from "vitest";

import { visibleNavItems, type NavItem } from "../navigation";
import { Role } from "../role";

const OPEN_ITEM: NavItem = {
  to: "/home",
  labelNs: "app",
  labelKey: "nav.home",
  iconSrc: "home.svg",
};
const COORDINATOR_ITEM: NavItem = {
  to: "/access",
  labelNs: "auth",
  labelKey: "nav.access",
  iconSrc: "persons.svg",
  minRole: Role.coordinator,
};
const ITEMS = [OPEN_ITEM, COORDINATOR_ITEM];

describe("visibleNavItems", () => {
  it("always shows an item without minRole, even without a role", () => {
    expect(visibleNavItems([OPEN_ITEM], null)).toEqual([OPEN_ITEM]);
    expect(visibleNavItems([OPEN_ITEM], Role.member)).toEqual([OPEN_ITEM]);
  });

  it.each([Role.coordinator, Role.superadmin])("shows a coordinator item to %s", (role) => {
    expect(visibleNavItems(ITEMS, role)).toEqual(ITEMS);
  });

  it.each([Role.member, Role.director])("hides a coordinator item from %s", (role) => {
    expect(visibleNavItems(ITEMS, role)).toEqual([OPEN_ITEM]);
  });

  it("hides an item with minRole when there is no role", () => {
    expect(visibleNavItems(ITEMS, null)).toEqual([OPEN_ITEM]);
  });

  it("keeps the declaration order", () => {
    expect(visibleNavItems([COORDINATOR_ITEM, OPEN_ITEM], Role.coordinator)).toEqual([
      COORDINATOR_ITEM,
      OPEN_ITEM,
    ]);
  });

  it("returns an empty list for an empty input", () => {
    expect(visibleNavItems([], Role.superadmin)).toEqual([]);
  });
});
