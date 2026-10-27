import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@shared/i18n";
import type { MenuGroup, MenuItem } from "@shared/lib/menu";

import { Sidebar, type SidebarProps } from "../layouts/Sidebar";
import { EXPANDED_GROUPS_STORAGE_KEY } from "../layouts/useExpandedMenuGroups";

const groups: MenuGroup[] = [
  { id: "catalog", label: "common:nav.groups.catalog", icon: "catalog.svg" },
  { id: "classes", label: "common:nav.groups.classes", icon: "classes.svg" },
  { id: "lessons", label: "common:nav.groups.lessons", icon: "lessons.svg" },
  { id: "people", label: "common:nav.groups.people", icon: "people.svg" },
  { id: "hours", label: "common:nav.groups.hours", icon: "hours.svg" },
];

const courses: MenuItem = {
  label: "common:nav.courses",
  path: "/courses",
  permission: "catalog.view",
  group: "catalog",
};
const classes: MenuItem = {
  label: "common:nav.classes",
  path: "/classes",
  permission: "classes.view",
  group: "classes",
};
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

const allItems = [courses, classes, lessons, calendar, students];

async function renderSidebar(route = "/profile", props: Partial<SidebarProps> = {}) {
  await i18n.changeLanguage("pt-BR");

  return render(
    <MemoryRouter initialEntries={[route]}>
      <Sidebar navId="app-sidebar-nav" items={allItems} groups={groups} {...props} />
    </MemoryRouter>,
  );
}

const groupButton = (name: string) => screen.getByRole("button", { name });
const isOpen = (name: string) => groupButton(name).getAttribute("aria-expanded") === "true";

describe("Sidebar", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("renders Catálogo and Pessoas, each with its own item", async () => {
    await renderSidebar("/profile", { items: [courses, students] });

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Catálogo",
      "Pessoas",
    ]);

    await userEvent.click(groupButton("Catálogo"));
    await userEvent.click(groupButton("Pessoas"));

    const catalog = within(screen.getByRole("group", { name: "Catálogo" }));
    const people = within(screen.getByRole("group", { name: "Pessoas" }));
    expect(catalog.getAllByRole("link").map((link) => link.textContent)).toEqual(["Cursos"]);
    expect(people.getAllByRole("link").map((link) => link.textContent)).toEqual(["Alunos"]);
  });

  it("shows the groups in the order of the groups prop, whatever the order of the items", async () => {
    await renderSidebar("/profile", { items: [students, calendar, courses] });

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Catálogo",
      "Aulas",
      "Pessoas",
    ]);
  });

  it("opens Aulas and marks Calendário on /lessons/calendar", async () => {
    await renderSidebar("/lessons/calendar");

    expect(isOpen("Aulas")).toBe(true);
    expect(screen.getByRole("link", { name: "Calendário" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Aulas" })).not.toHaveAttribute("aria-current");
    expect(isOpen("Catálogo")).toBe(false);
    expect(isOpen("Turmas")).toBe(false);
    expect(isOpen("Pessoas")).toBe(false);
  });

  it("opens Turmas on a nested route (/classes/:id)", async () => {
    await renderSidebar("/classes/6a1f");

    expect(isOpen("Turmas")).toBe(true);
    expect(screen.getByRole("link", { name: "Turmas" })).toHaveAttribute("aria-current", "page");
    expect(isOpen("Aulas")).toBe(false);
  });

  it("keeps every group closed on /profile", async () => {
    await renderSidebar("/profile");

    for (const name of ["Catálogo", "Turmas", "Aulas", "Pessoas"]) {
      expect(isOpen(name)).toBe(false);
    }
    const nav = within(screen.getByRole("navigation", { name: "Menu principal" }));
    expect(nav.queryByRole("link")).not.toBeInTheDocument();
  });

  it("announces the current page with aria-current", async () => {
    await renderSidebar("/students");

    const current = screen.getAllByRole("link", { current: "page" });
    expect(current.map((link) => link.textContent)).toEqual(["Alunos"]);
  });

  it("opens and closes a group from the keyboard", async () => {
    const user = userEvent.setup();
    await renderSidebar("/profile");

    const catalog = groupButton("Catálogo");
    for (let presses = 0; document.activeElement !== catalog && presses < 10; presses += 1) {
      await user.tab();
    }
    expect(catalog).toHaveFocus();
    expect(catalog).toHaveAttribute("aria-expanded", "false");

    await user.keyboard("{Enter}");
    expect(catalog).toHaveAttribute("aria-expanded", "true");

    // Aberto, o próximo Tab entra no grupo.
    await user.tab();
    expect(screen.getByRole("link", { name: "Cursos" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(catalog).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(catalog).toHaveAttribute("aria-expanded", "false");

    await user.keyboard(" ");
    expect(catalog).toHaveAttribute("aria-expanded", "true");
  });

  it("lets the user open several groups and close the one of the route", async () => {
    await renderSidebar("/lessons/calendar");

    await userEvent.click(groupButton("Pessoas"));
    expect(isOpen("Aulas")).toBe(true);
    expect(isOpen("Pessoas")).toBe(true);

    await userEvent.click(groupButton("Aulas"));
    expect(isOpen("Aulas")).toBe(false);
    expect(isOpen("Pessoas")).toBe(true);
  });

  it("keeps what the user opened for the next sidebar of the session", async () => {
    const { unmount } = await renderSidebar("/profile");

    await userEvent.click(groupButton("Pessoas"));
    expect(JSON.parse(sessionStorage.getItem(EXPANDED_GROUPS_STORAGE_KEY) as string)).toEqual([
      "people",
    ]);
    unmount();

    await renderSidebar("/profile", { navId: "app-drawer-nav" });
    expect(isOpen("Pessoas")).toBe(true);
    expect(isOpen("Catálogo")).toBe(false);
  });

  it("calls onNavigate when an item is chosen", async () => {
    const onNavigate = vi.fn();
    await renderSidebar("/lessons", { onNavigate });

    await userEvent.click(screen.getByRole("link", { name: "Calendário" }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("labels the navigation and sets its id", async () => {
    await renderSidebar("/profile", { navId: "app-drawer-nav" });

    expect(screen.getByRole("navigation", { name: "Menu principal" })).toHaveAttribute(
      "id",
      "app-drawer-nav",
    );
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
  });

  it("shows the brand", async () => {
    await renderSidebar();

    expect(screen.getByRole("link", { name: "TEDI, ir para o início" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("shows the empty message without items", async () => {
    await renderSidebar("/profile", { items: [] });

    expect(screen.getByText("Nenhuma área disponível para o seu perfil.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Menu principal" })).toBeInTheDocument();
  });
});
