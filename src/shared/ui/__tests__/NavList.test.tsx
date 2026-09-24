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
});
