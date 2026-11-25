import { createRef, useState } from "react";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AccessFilters } from "../components/AccessFilters";
import type { MemberRoleFilter, MemberStatusFilter } from "../lib/member-filters";
import { renderWithProviders } from "./test-utils";

interface HarnessProps {
  initialSearch?: string;
  initialRole?: MemberRoleFilter;
  initialStatus?: MemberStatusFilter;
  onSearchChange?: (value: string) => void;
  onFilterChange?: (key: "role" | "status", value: string) => void;
}

/** Keeps the state the page keeps, so the controls show what was chosen. */
function Harness({
  initialSearch = "",
  initialRole = "",
  initialStatus = "",
  onSearchChange,
  onFilterChange,
}: HarnessProps) {
  const [search, setSearch] = useState(initialSearch);
  const [role, setRole] = useState(initialRole);
  const [status, setStatus] = useState(initialStatus);

  return (
    <AccessFilters
      search={search}
      onSearchChange={(value) => {
        setSearch(value);
        onSearchChange?.(value);
      }}
      role={role}
      status={status}
      onFilterChange={(key, value) => {
        if (key === "role") setRole(value as MemberRoleFilter);
        else setStatus(value as MemberStatusFilter);
        onFilterChange?.(key, value);
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

  it("offers only search, Papel and Status", async () => {
    await renderWithProviders(<Harness />);

    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Papel/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Status/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Turma/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Data da aula/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Turma/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Data da aula/)).not.toBeInTheDocument();
  });

  it("shows the search placeholder and the unfiltered defaults", async () => {
    await renderWithProviders(<Harness />);

    expect(screen.getByPlaceholderText("Buscar por nome ou RA…")).toBe(
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

  it("shows the filters it is given", async () => {
    await renderWithProviders(
      <Harness initialSearch="Ana" initialRole="director" initialStatus="pending" />,
    );

    expect(screen.getByRole("textbox", { name: "Buscar por nome ou RA" })).toHaveValue("Ana");
    expect(screen.getByRole("button", { name: /Papel: Diretor/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Status: A validar/ })).toBeInTheDocument();
  });

  it("reports the search as the user types", async () => {
    const onSearchChange = vi.fn();
    const user = userEvent.setup();
    await renderWithProviders(<Harness onSearchChange={onSearchChange} />);

    await user.type(screen.getByRole("textbox", { name: "Buscar por nome ou RA" }), "Ana");

    expect(onSearchChange).toHaveBeenLastCalledWith("Ana");
    expect(screen.getByRole("textbox", { name: "Buscar por nome ou RA" })).toHaveValue("Ana");
  });

  it("reports role director when Diretor is chosen", async () => {
    const onFilterChange = vi.fn();
    const user = userEvent.setup();
    await renderWithProviders(<Harness onFilterChange={onFilterChange} />);

    await user.click(screen.getByRole("button", { name: /Papel: todos/ }));
    await user.click(await screen.findByRole("option", { name: "Diretor" }));

    expect(onFilterChange).toHaveBeenLastCalledWith("role", "director");
    expect(screen.getByRole("button", { name: /Papel: Diretor/ })).toHaveTextContent(
      "Papel: Diretor",
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
      "Diretor",
      "Coordenadora",
    ]);
  });

  it("offers Todos, Ativo, Inativo and A validar in Status", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<Harness />);

    await user.click(screen.getByRole("button", { name: /Status: todos/ }));

    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Todos",
      "Ativo",
      "Inativo",
      "A validar",
    ]);
  });

  it("reports status inactive when Inativo is chosen", async () => {
    const onFilterChange = vi.fn();
    const user = userEvent.setup();
    await renderWithProviders(<Harness onFilterChange={onFilterChange} />);

    await user.click(screen.getByRole("button", { name: /Status: todos/ }));
    await user.click(await screen.findByRole("option", { name: "Inativo" }));

    expect(onFilterChange).toHaveBeenLastCalledWith("status", "inactive");
    expect(screen.getByRole("button", { name: /Status: Inativo/ })).toHaveTextContent(
      "Status: Inativo",
    );
  });

  it("reports status pending when A validar is chosen", async () => {
    const onFilterChange = vi.fn();
    const user = userEvent.setup();
    await renderWithProviders(<Harness onFilterChange={onFilterChange} />);

    await user.click(screen.getByRole("button", { name: /Status: todos/ }));
    await user.click(await screen.findByRole("option", { name: "A validar" }));

    expect(onFilterChange).toHaveBeenLastCalledWith("status", "pending");
    expect(screen.getByRole("button", { name: /Status: A validar/ })).toHaveTextContent(
      "Status: A validar",
    );
  });

  it("reports the empty value when Todos is chosen again", async () => {
    const onFilterChange = vi.fn();
    const user = userEvent.setup();
    await renderWithProviders(<Harness onFilterChange={onFilterChange} />);

    await user.click(screen.getByRole("button", { name: /Status: todos/ }));
    await user.click(await screen.findByRole("option", { name: "Ativo" }));
    await user.click(screen.getByRole("button", { name: /Status: Ativo/ }));
    await user.click(await screen.findByRole("option", { name: "Todos" }));

    expect(onFilterChange).toHaveBeenLastCalledWith("status", "");
    expect(screen.getByRole("button", { name: /Status: todos/ })).toBeInTheDocument();
  });

  it("keeps the other filters when one of them changes", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<Harness />);

    await user.type(screen.getByRole("textbox", { name: "Buscar por nome ou RA" }), "Ana");
    await user.click(screen.getByRole("button", { name: /Papel: todos/ }));
    await user.click(await screen.findByRole("option", { name: "Coordenadora" }));
    await user.click(screen.getByRole("button", { name: /Status: todos/ }));
    await user.click(await screen.findByRole("option", { name: "Ativo" }));

    expect(screen.getByRole("textbox", { name: "Buscar por nome ou RA" })).toHaveValue("Ana");
    expect(screen.getByRole("button", { name: /Papel: Coordenadora/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Status: Ativo/ })).toBeInTheDocument();
  });

  it("forwards searchInputRef to the search input", async () => {
    const searchInputRef = createRef<HTMLInputElement>();
    await renderWithProviders(
      <AccessFilters
        search=""
        onSearchChange={vi.fn()}
        role=""
        status=""
        onFilterChange={vi.fn()}
        searchInputRef={searchInputRef}
      />,
    );

    expect(searchInputRef.current).toBe(
      screen.getByRole("textbox", { name: "Buscar por nome ou RA" }),
    );
  });

  it("does not submit the form when Enter is pressed in the search field", async () => {
    await renderWithProviders(<Harness />);

    const form = screen.getByRole("search");
    // fireEvent returns false when some handler called preventDefault.
    expect(fireEvent.submit(form)).toBe(false);
  });
});
