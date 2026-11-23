import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CalendarToolbar } from "../components/CalendarToolbar";
import type { CalendarView } from "../lib/calendar-period";
import { renderWithProviders, setupLessonsTestServer } from "./test-utils";

setupLessonsTestServer();

async function renderToolbar(view: CalendarView = "month", title = "março de 2026") {
  const handlers = {
    onViewChange: vi.fn(),
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onToday: vi.fn(),
  };
  const result = await renderWithProviders(
    <CalendarToolbar view={view} title={title} {...handlers} />,
  );
  return { ...result, ...handlers };
}

const viewGroup = () => screen.getByRole("group", { name: "Visualização" });

describe("CalendarToolbar", () => {
  it.each([
    ["month", "Mês anterior", "Próximo mês"],
    ["list", "Mês anterior", "Próximo mês"],
    ["week", "Semana anterior", "Próxima semana"],
  ] as const)("names the arrows by what they do in the view %s", async (view, previous, next) => {
    await renderToolbar(view);

    expect(screen.getByRole("button", { name: previous })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: next })).toBeInTheDocument();
  });

  it("the arrows and Hoje call what they were given", async () => {
    const user = userEvent.setup();
    const { onPrevious, onNext, onToday } = await renderToolbar();

    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    await user.click(screen.getByRole("button", { name: "Hoje" }));

    expect(onPrevious).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
    expect(onToday).toHaveBeenCalledOnce();
  });

  it("offers Lista, Mês and Semana, and says which one is on", async () => {
    await renderToolbar("week");

    const buttons = within(viewGroup()).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Lista", "Mês", "Semana"]);
    expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual([
      "false",
      "false",
      "true",
    ]);
  });

  it.each([
    ["Lista", "list"],
    ["Mês", "month"],
    ["Semana", "week"],
  ] as const)("%s asks for the view %s", async (name, view) => {
    const user = userEvent.setup();
    const { onViewChange } = await renderToolbar("month");

    await user.click(within(viewGroup()).getByRole("button", { name }));

    expect(onViewChange).toHaveBeenCalledExactlyOnceWith(view);
  });

  it("writes the period as a polite live region", async () => {
    await renderToolbar("week", "8 – 14 de março de 2026");

    const title = screen.getByText("8 – 14 de março de 2026");
    expect(title).toHaveAttribute("aria-live", "polite");
  });

  it("shows the legend Monitores abaixo do esperado as text", async () => {
    await renderToolbar();

    expect(screen.getByText("Monitores abaixo do esperado")).toBeInTheDocument();
  });

  it("has icon buttons 44px wide and high", async () => {
    await renderToolbar();

    for (const name of ["Mês anterior", "Próximo mês"]) {
      expect(screen.getByRole("button", { name })).toHaveClass("min-h-11", "min-w-11");
    }
  });
});
