import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { NavList } from "../NavList";

const items = [
  { label: "Cursos", path: "/courses", icon: "courses.svg" },
  { label: "Turmas", path: "/classes" },
];

function renderNav(props: Partial<Parameters<typeof NavList>[0]> = {}, route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <NavList items={items} label="Menu principal" emptyLabel="Nada aqui" {...props} />
    </MemoryRouter>,
  );
}

describe("NavList", () => {
  it("renders a labelled navigation with one link per item", () => {
    renderNav();

    const nav = screen.getByRole("navigation", { name: "Menu principal" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cursos" })).toHaveAttribute("href", "/courses");
    expect(screen.getByRole("link", { name: "Turmas" })).toHaveAttribute("href", "/classes");
  });

  it("marks the current page", () => {
    renderNav({}, "/classes");

    expect(screen.getByRole("link", { name: "Turmas" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Cursos" })).not.toHaveAttribute("aria-current");
  });

  it("keeps the 44px touch target and the 16px font", () => {
    renderNav();

    expect(screen.getByRole("link", { name: "Cursos" })).toHaveClass("min-h-11", "text-base");
  });

  it("shows the empty message when there are no items", () => {
    renderNav({ items: [] });

    expect(screen.getByText("Nada aqui")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("calls onNavigate when an item is chosen", async () => {
    const onNavigate = vi.fn();
    renderNav({ onNavigate });

    await userEvent.click(screen.getByRole("link", { name: "Cursos" }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("marks only the longest matching item as current", () => {
    renderNav(
      {
        items: [
          { label: "Aulas", path: "/lessons" },
          { label: "Calendário", path: "/lessons/calendar" },
        ],
      },
      "/lessons/calendar",
    );

    expect(screen.getByRole("link", { name: "Calendário" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Aulas" })).not.toHaveAttribute("aria-current");
  });

  it("marks the parent item on a nested route", () => {
    renderNav({}, "/classes/abc");

    expect(screen.getByRole("link", { name: "Turmas" })).toHaveAttribute("aria-current", "page");
  });

  it("marks no item when the route matches none", () => {
    renderNav({}, "/profile");

    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.queryByRole("link", { current: "page" })).not.toBeInTheDocument();
  });

  it("uses activePath instead of the location when given", () => {
    renderNav({ activePath: "/courses" }, "/classes");

    expect(screen.getByRole("link", { name: "Cursos" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Turmas" })).not.toHaveAttribute("aria-current");
  });

  it("marks no item when activePath is null", () => {
    renderNav({ activePath: null }, "/classes");

    expect(screen.queryByRole("link", { current: "page" })).not.toBeInTheDocument();
  });

  it("styles the current item apart from the others", () => {
    renderNav({}, "/classes");

    expect(screen.getByRole("link", { name: "Turmas" })).toHaveClass("bg-white", "font-semibold");
    expect(screen.getByRole("link", { name: "Cursos" })).toHaveClass("font-medium");
    expect(screen.getByRole("link", { name: "Cursos" })).not.toHaveClass("bg-white");
  });

  it("renders a bare list without a navigation landmark when no label is given", () => {
    renderNav({ label: undefined, emptyLabel: undefined, id: "group-list", className: "trail" });

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    const list = screen.getByRole("list");
    expect(list).toHaveAttribute("id", "group-list");
    expect(list).toHaveClass("trail");
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("spaces the items by default and lets className decide the spacing", () => {
    const { unmount } = renderNav();
    expect(screen.getByRole("list")).toHaveClass("flex", "flex-col", "gap-1.5");
    unmount();

    renderNav({ className: "gap-1" });

    expect(screen.getByRole("list")).toHaveClass("gap-1");
    expect(screen.getByRole("list")).not.toHaveClass("gap-1.5");
  });

  it("puts the id on the navigation landmark when it has a label", () => {
    renderNav({ id: "app-nav", className: "trail" });

    expect(screen.getByRole("navigation", { name: "Menu principal" })).toHaveAttribute(
      "id",
      "app-nav",
    );
    expect(screen.getByRole("list")).not.toHaveAttribute("id");
    expect(screen.getByRole("list")).toHaveClass("trail");
  });

  it("renders nothing when there are no items and no empty message", () => {
    const { container } = renderNav({ items: [], emptyLabel: undefined });

    expect(container).toBeEmptyDOMElement();
  });
});
