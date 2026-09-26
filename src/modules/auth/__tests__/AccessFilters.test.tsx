import { useState } from "react";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AccessFilters } from "../components/AccessFilters";
import { EMPTY_ACCESS_FILTERS, type AccessFilterValues } from "../lib/access-filters";
import { renderWithProviders } from "./test-utils";

function Harness({ onChange }: { onChange?: (next: AccessFilterValues) => void }) {
  const [value, setValue] = useState<AccessFilterValues>(EMPTY_ACCESS_FILTERS);

  return (
    <AccessFilters
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("AccessFilters", () => {
  it("every control has an accessible name", async () => {
    await renderWithProviders(<Harness />);

    expect(screen.getByRole("search", { name: "Filtros da lista de membros" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Buscar por nome ou RA" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Papel/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Status/ })).toBeInTheDocument();
  });

  it("shows the search placeholder and the unfiltered defaults", async () => {
    await renderWithProviders(<Harness />);

    expect(screen.getByPlaceholderText("Buscar membro por nome…")).toBe(
      screen.getByRole("textbox", { name: "Buscar por nome ou RA" }),
    );
    expect(screen.getByRole("button", { name: /Papel: todos/ })).toHaveTextContent("Papel: todos");
    expect(screen.getByRole("button", { name: /Status: todos/ })).toHaveTextContent(
      "Status: todos",
    );
  });

  it("does not show the labels visually", async () => {
    await renderWithProviders(<Harness />);

    expect(screen.getByText("Buscar por nome ou RA")).toHaveClass("sr-only");
    expect(screen.getByText("Papel")).toHaveClass("sr-only");
    expect(screen.getByText("Status")).toHaveClass("sr-only");
  });

  it("reports the search as the user types", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    await renderWithProviders(<Harness onChange={onChange} />);

    await user.type(screen.getByRole("textbox", { name: "Buscar por nome ou RA" }), "Ana");

    expect(onChange).toHaveBeenLastCalledWith({ search: "Ana", role: "all", status: "all" });
  });

  it("reports role director when Diretor(a) is chosen", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    await renderWithProviders(<Harness onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /Papel: todos/ }));
    await user.click(await screen.findByRole("option", { name: "Diretor(a)" }));

    expect(onChange).toHaveBeenLastCalledWith({ search: "", role: "director", status: "all" });
    expect(screen.getByRole("button", { name: /Papel: Diretor\(a\)/ })).toHaveTextContent(
      "Papel: Diretor(a)",
    );
  });

  it("offers every invitable role plus Todos", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<Harness />);

    await user.click(screen.getByRole("button", { name: /Papel: todos/ }));

    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Todos",
      "Membro",
      "Diretor(a)",
      "Coordenadora",
    ]);
  });

  it("reports status inactive when Inativo is chosen", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    await renderWithProviders(<Harness onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /Status: todos/ }));
    await user.click(await screen.findByRole("option", { name: "Inativo" }));

    expect(onChange).toHaveBeenLastCalledWith({ search: "", role: "all", status: "inactive" });
    expect(screen.getByRole("button", { name: /Status: Inativo/ })).toHaveTextContent(
      "Status: Inativo",
    );
  });

  it("returns to the unfiltered value when Todos is chosen again", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    await renderWithProviders(<Harness onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /Status: todos/ }));
    await user.click(await screen.findByRole("option", { name: "Ativo" }));
    await user.click(screen.getByRole("button", { name: /Status: Ativo/ }));
    await user.click(await screen.findByRole("option", { name: "Todos" }));

    expect(onChange).toHaveBeenLastCalledWith({ search: "", role: "all", status: "all" });
    expect(screen.getByRole("button", { name: /Status: todos/ })).toBeInTheDocument();
  });

  it("keeps the other filters when one of them changes", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    await renderWithProviders(<Harness onChange={onChange} />);

    await user.type(screen.getByRole("textbox", { name: "Buscar por nome ou RA" }), "Ana");
    await user.click(screen.getByRole("button", { name: /Papel: todos/ }));
    await user.click(await screen.findByRole("option", { name: "Coordenadora" }));
    await user.click(screen.getByRole("button", { name: /Status: todos/ }));
    await user.click(await screen.findByRole("option", { name: "Ativo" }));

    expect(onChange).toHaveBeenLastCalledWith({
      search: "Ana",
      role: "coordinator",
      status: "active",
    });
  });

  it("does not submit the form when Enter is pressed in the search field", async () => {
    await renderWithProviders(<Harness />);

    const form = screen.getByRole("search");
    // fireEvent devolve false quando algum handler chamou preventDefault.
    expect(fireEvent.submit(form)).toBe(false);
  });
});
