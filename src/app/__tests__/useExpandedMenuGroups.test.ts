import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MenuItem } from "@shared/lib/menu";

import {
  EXPANDED_GROUPS_STORAGE_KEY,
  useExpandedMenuGroups,
} from "../layouts/useExpandedMenuGroups";

const lessons: MenuItem = {
  label: "common:nav.lessons",
  path: "/lessons",
  permission: "lessons.view",
  group: "lessons",
};
const calendar: MenuItem = {
  label: "common:nav.calendar",
  path: "/lessons/calendar",
  permission: "lessons.view",
  group: "lessons",
};
const students: MenuItem = {
  label: "common:nav.students",
  path: "/students",
  permission: "students.view",
  group: "people",
};

function renderGroups(initialItem: MenuItem | null = null) {
  return renderHook(({ item }) => useExpandedMenuGroups(item), {
    initialProps: { item: initialItem },
  });
}

const stored = () => sessionStorage.getItem(EXPANDED_GROUPS_STORAGE_KEY);

describe("useExpandedMenuGroups", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps every group closed without an active item and nothing stored", () => {
    const { result } = renderGroups();

    expect(result.current.expandedGroups).toEqual([]);
  });

  it("opens the active group on mount and when the active item changes", () => {
    const { result, rerender } = renderGroups(calendar);
    expect(result.current.expandedGroups).toEqual(["lessons"]);

    rerender({ item: students });
    expect(result.current.expandedGroups).toEqual(["lessons", "people"]);

    // Fora do menu (ex.: /profile): nada abre nem fecha.
    rerender({ item: null });
    expect(result.current.expandedGroups).toEqual(["lessons", "people"]);
  });

  it("opens the group once when the route moves within the same group", () => {
    const { result, rerender } = renderGroups(lessons);

    rerender({ item: calendar });

    expect(result.current.expandedGroups).toEqual(["lessons"]);
  });

  it("does not store the groups that the route opened", () => {
    const { rerender } = renderGroups(calendar);
    rerender({ item: students });

    expect(stored()).toBeNull();
  });

  it("restores the groups opened in this session", () => {
    sessionStorage.setItem(EXPANDED_GROUPS_STORAGE_KEY, JSON.stringify(["hours", "catalog"]));

    expect(renderGroups().result.current.expandedGroups).toEqual(["hours", "catalog"]);
    expect(renderGroups(calendar).result.current.expandedGroups).toEqual([
      "hours",
      "catalog",
      "lessons",
    ]);
  });

  it.each([
    ["text that is not JSON", "{oops"],
    ["a JSON object", JSON.stringify({ catalog: true })],
    ["a JSON string", JSON.stringify("catalog")],
  ])("ignores %s in the storage", (_name, value) => {
    sessionStorage.setItem(EXPANDED_GROUPS_STORAGE_KEY, value);

    expect(renderGroups().result.current.expandedGroups).toEqual([]);
  });

  it("ignores invalid stored values and repeated groups", () => {
    sessionStorage.setItem(
      EXPANDED_GROUPS_STORAGE_KEY,
      JSON.stringify(["catalog", "settings", 3, null, "catalog", "people"]),
    );

    expect(renderGroups().result.current.expandedGroups).toEqual(["catalog", "people"]);
  });

  it("persists manual changes to sessionStorage", () => {
    const { result } = renderGroups(calendar);

    act(() => result.current.setExpandedGroups(["lessons", "hours"]));

    expect(result.current.expandedGroups).toEqual(["lessons", "hours"]);
    expect(JSON.parse(stored() as string)).toEqual(["lessons", "hours"]);

    // Uma sidebar nova (ex.: o Drawer, ao abrir) começa pelo que foi guardado.
    expect(renderGroups(students).result.current.expandedGroups).toEqual([
      "lessons",
      "hours",
      "people",
    ]);
  });

  it("lets the user close the active group", () => {
    const { result, rerender } = renderGroups(calendar);

    act(() => result.current.setExpandedGroups([]));
    expect(result.current.expandedGroups).toEqual([]);

    // Renderizar de novo na mesma rota não reabre o grupo.
    rerender({ item: calendar });
    expect(result.current.expandedGroups).toEqual([]);
    expect(stored()).toBe("[]");
  });

  it("opens the group again when the route changes after the user closed it", () => {
    const { result, rerender } = renderGroups(calendar);
    act(() => result.current.setExpandedGroups([]));

    rerender({ item: lessons });

    expect(result.current.expandedGroups).toEqual(["lessons"]);
  });

  it("keeps working when sessionStorage is not available", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const { result } = renderGroups(calendar);
    expect(result.current.expandedGroups).toEqual(["lessons"]);

    act(() => result.current.setExpandedGroups(["lessons", "people"]));

    expect(result.current.expandedGroups).toEqual(["lessons", "people"]);
  });

  it("returns a stable setter", () => {
    const { result, rerender } = renderGroups(calendar);
    const setter = result.current.setExpandedGroups;

    rerender({ item: students });

    expect(result.current.setExpandedGroups).toBe(setter);
  });
});
