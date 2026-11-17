import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Role } from "@shared/lib/role";

import { AccessTable } from "../components/AccessTable";
import { buildAccess } from "./handlers";
import { renderWithProviders } from "./test-utils";

const ROWS = [
  buildAccess({ id: "1", name: "Ana Torres", role: Role.coordinator, accessEnabled: true }),
  buildAccess({ id: "2", name: "Beto Nunes", role: Role.director, accessEnabled: false }),
  buildAccess({ id: "3", name: "Caio Lopes", role: Role.member, accessEnabled: true }),
];

describe("AccessTable", () => {
  it("renders one row per person with name, translated role and status", async () => {
    await renderWithProviders(<AccessTable rows={ROWS} />);

    expect(screen.getAllByRole("row")).toHaveLength(4);

    const ana = screen.getByRole("row", { name: /Ana Torres/ });
    expect(within(ana).getByText("Coordenadora")).toBeInTheDocument();
    expect(within(ana).getByText("Ativo")).toBeInTheDocument();

    const beto = screen.getByRole("row", { name: /Beto Nunes/ });
    expect(within(beto).getByText("Diretor")).toBeInTheDocument();
    expect(within(beto).getByText("Inativo")).toBeInTheDocument();

    const caio = screen.getByRole("row", { name: /Caio Lopes/ });
    expect(within(caio).getByText("Membro")).toBeInTheDocument();
    expect(within(caio).getByText("Ativo")).toBeInTheDocument();
  });

  it("renders the six Figma columns in order", async () => {
    await renderWithProviders(<AccessTable rows={ROWS} />);

    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Membro",
      "Papel",
      "Departamento",
      "Função principal",
      "Status",
      "Ações",
    ]);
  });

  it("names the table by its caption", async () => {
    await renderWithProviders(<AccessTable rows={ROWS} />);

    expect(screen.getByRole("table", { name: "Membros com acesso ao TEDI" })).toBeInTheDocument();
  });

  it("leaves Departamento and Função principal empty", async () => {
    await renderWithProviders(<AccessTable rows={ROWS} />);

    for (const row of screen.getAllByRole("row").slice(1)) {
      const cells = within(row).getAllByRole("cell");
      expect(cells).toHaveLength(6);
      expect(cells[2]).toBeEmptyDOMElement();
      expect(cells[3]).toBeEmptyDOMElement();
    }
  });

  it("each row has an actions button named after the person", async () => {
    await renderWithProviders(<AccessTable rows={ROWS} />);

    for (const name of ["Ana Torres", "Beto Nunes", "Caio Lopes"]) {
      const row = screen.getByRole("row", { name: new RegExp(name) });
      expect(within(row).getByRole("button", { name: `Ações de ${name}` })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button")).toHaveLength(ROWS.length);
  });

  it("row actions are reachable by keyboard, after the link of the name of each person", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<AccessTable rows={ROWS} />);

    await user.tab();
    expect(screen.getByRole("link", { name: "Ana Torres" })).toHaveFocus();

    await user.tab();
    const ana = screen.getByRole("button", { name: "Ações de Ana Torres" });
    expect(ana).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("link", { name: "Beto Nunes" })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("button", { name: "Ações de Beto Nunes" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(ana).not.toHaveAttribute("aria-haspopup");
  });

  it("does not show the RA nor the email of the person", async () => {
    await renderWithProviders(
      <AccessTable rows={[buildAccess({ ra: "2024RA0001", email: "ana@example.com" })]} />,
    );

    expect(screen.queryByText("2024RA0001")).not.toBeInTheDocument();
    expect(screen.queryByText("ana@example.com")).not.toBeInTheDocument();
  });

  it("shows a superadmin as Coordenadora", async () => {
    await renderWithProviders(
      <AccessTable rows={[buildAccess({ name: "Dora Admin", role: Role.superadmin })]} />,
    );

    const row = screen.getByRole("row", { name: /Dora Admin/ });
    expect(within(row).getByText("Coordenadora")).toBeInTheDocument();
    expect(within(row).queryByText(/superadmin/i)).not.toBeInTheDocument();
  });

  it("shows no role badge when the person has no role", async () => {
    await renderWithProviders(
      <AccessTable rows={[buildAccess({ name: "Eva Sem Papel", role: null })]} />,
    );

    const row = screen.getByRole("row", { name: /Eva Sem Papel/ });
    expect(within(row).getAllByRole("cell")[1]).toBeEmptyDOMElement();
  });

  it("colours the role and status badges by tone", async () => {
    await renderWithProviders(<AccessTable rows={ROWS} />);

    const ana = screen.getByRole("row", { name: /Ana Torres/ });
    expect(within(ana).getByText("Coordenadora")).toHaveClass("bg-tedi-highlight");
    expect(within(ana).getByText("Ativo")).toHaveClass("bg-tedi-badge-success");

    const beto = screen.getByRole("row", { name: /Beto Nunes/ });
    expect(within(beto).getByText("Diretor")).toHaveClass("bg-tedi-badge");
    expect(within(beto).getByText("Inativo")).toHaveClass("bg-tedi-neutral");

    const caio = screen.getByRole("row", { name: /Caio Lopes/ });
    expect(within(caio).getByText("Membro")).toHaveClass("bg-tedi-neutral");
  });

  it("keeps the column headers and draws no row when there are no people", async () => {
    await renderWithProviders(<AccessTable rows={[]} />);

    expect(screen.getAllByRole("columnheader")).toHaveLength(6);
    expect(screen.queryAllByRole("cell")).toHaveLength(0);
  });

  it("renders the name as a link to /members/:id", async () => {
    await renderWithProviders(<AccessTable rows={ROWS} />);

    for (const { id, name } of ROWS) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", `/members/${id}`);
    }
    expect(screen.getAllByRole("link")).toHaveLength(ROWS.length);
  });

  it("opens the member with the keyboard, from the link of the name", async () => {
    const user = userEvent.setup();
    const { router } = await renderWithProviders(<AccessTable rows={ROWS} />);

    await user.tab();
    await user.keyboard("{Enter}");

    expect(router.state.location.pathname).toBe("/members/1");
  });

  it("calls onRowClick when a cell of the row is clicked", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    await renderWithProviders(<AccessTable rows={ROWS} onRowClick={onRowClick} />);

    // The Departamento cell has nothing in it: the click lands on the cell, not on a control.
    const beto = screen.getByRole("row", { name: /Beto Nunes/ });
    await user.click(within(beto).getAllByRole("cell")[2]);

    expect(onRowClick).toHaveBeenCalledExactlyOnceWith(ROWS[1]);
  });

  it("calls onRowClick when the badge of the status is clicked", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    await renderWithProviders(<AccessTable rows={ROWS} onRowClick={onRowClick} />);

    const caio = screen.getByRole("row", { name: /Caio Lopes/ });
    await user.click(within(caio).getByText("Ativo"));

    expect(onRowClick).toHaveBeenCalledExactlyOnceWith(ROWS[2]);
  });

  it("does not call onRowClick when the actions button is clicked", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    await renderWithProviders(<AccessTable rows={ROWS} onRowClick={onRowClick} />);

    await user.click(screen.getByRole("button", { name: "Ações de Ana Torres" }));

    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("does not call onRowClick when the link of the name is clicked: the link opens the member itself", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const { router } = await renderWithProviders(
      <AccessTable rows={ROWS} onRowClick={onRowClick} />,
    );

    await user.click(screen.getByRole("link", { name: "Caio Lopes" }));

    expect(onRowClick).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/members/3");
  });

  it("is not clickable without onRowClick", async () => {
    const user = userEvent.setup();
    const { router } = await renderWithProviders(<AccessTable rows={ROWS} />);

    const ana = screen.getByRole("row", { name: /Ana Torres/ });
    expect(ana).not.toHaveClass("cursor-pointer");
    await user.click(within(ana).getAllByRole("cell")[2]);

    expect(router.state.location.pathname).toBe("/");
  });

  it("shows the pointer and the highlight on the rows when onRowClick is given", async () => {
    await renderWithProviders(<AccessTable rows={ROWS} onRowClick={vi.fn()} />);

    for (const row of screen.getAllByRole("row").slice(1)) {
      expect(row).toHaveClass("cursor-pointer");
      expect(row.className).toContain("hover:shadow-[inset_3px_0_0_var(--accent)]");
    }
  });
});
