import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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

    // Uma linha de cabeçalho mais uma por pessoa.
    expect(screen.getAllByRole("row")).toHaveLength(4);

    const ana = screen.getByRole("row", { name: /Ana Torres/ });
    expect(within(ana).getByText("Coordenadora")).toBeInTheDocument();
    expect(within(ana).getByText("Ativo")).toBeInTheDocument();

    const beto = screen.getByRole("row", { name: /Beto Nunes/ });
    expect(within(beto).getByText("Diretor(a)")).toBeInTheDocument();
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
      "Departamentos",
      "Função principal",
      "Status",
      "Ações",
    ]);
  });

  it("names the table by its caption", async () => {
    await renderWithProviders(<AccessTable rows={ROWS} />);

    expect(screen.getByRole("table", { name: "Membros com acesso ao TEDI" })).toBeInTheDocument();
  });

  it("leaves Departamentos, Função principal and Ações empty", async () => {
    await renderWithProviders(<AccessTable rows={ROWS} />);

    for (const row of screen.getAllByRole("row").slice(1)) {
      const cells = within(row).getAllByRole("cell");
      expect(cells).toHaveLength(6);
      expect(cells[2]).toBeEmptyDOMElement();
      expect(cells[3]).toBeEmptyDOMElement();
      expect(cells[5]).toBeEmptyDOMElement();
    }
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
    expect(within(beto).getByText("Diretor(a)")).toHaveClass("bg-tedi-badge");
    expect(within(beto).getByText("Inativo")).toHaveClass("bg-tedi-neutral");

    const caio = screen.getByRole("row", { name: /Caio Lopes/ });
    expect(within(caio).getByText("Membro")).toHaveClass("bg-tedi-neutral");
  });

  it("empty list shows Nenhum acesso encontrado", async () => {
    await renderWithProviders(<AccessTable rows={[]} />);

    expect(screen.getByRole("cell", { name: "Nenhum acesso encontrado" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(6);
  });
});
