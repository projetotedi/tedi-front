import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MemberRegistrationStatus, MemberStatus } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { AccessTable } from "../components/AccessTable";
import { buildMember } from "./handlers";
import { renderWithProviders } from "./test-utils";

const ROWS = [
  buildMember({ id: "1", name: "Ana Torres", role: Role.coordinator }),
  buildMember({
    id: "2",
    name: "Beto Nunes",
    role: Role.director,
    status: MemberStatus.inactive,
    department: { id: "d2", name: "Tecnologia" },
    mainFunction: "Diretor de projetos",
  }),
  buildMember({ id: "3", name: "Caio Lopes", role: Role.member }),
];

/** A registration that just arrived: the API has no role, no function and no access for it yet. */
const PENDING = buildMember({
  id: "4",
  name: "Lucas Souza",
  role: null,
  accessEnabled: false,
  mainFunction: null,
  joinedAt: null,
  registrationStatus: MemberRegistrationStatus.pending,
  department: { id: "d2", name: "Tecnologia" },
});

const REJECTED = buildMember({
  id: "5",
  name: "Rita Lima",
  role: null,
  accessEnabled: false,
  registrationStatus: MemberRegistrationStatus.rejected,
});

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

    expect(screen.getByRole("table", { name: "Membros do TEDI" })).toBeInTheDocument();
  });

  it("shows the department name and the main function", async () => {
    await renderWithProviders(<AccessTable rows={ROWS} />);

    const ana = within(screen.getByRole("row", { name: /Ana Torres/ })).getAllByRole("cell");
    expect(ana[2]).toHaveTextContent("Pedagogia");
    expect(ana[3]).toHaveTextContent("Monitora");

    const beto = within(screen.getByRole("row", { name: /Beto Nunes/ })).getAllByRole("cell");
    expect(beto[2]).toHaveTextContent("Tecnologia");
    expect(beto[3]).toHaveTextContent("Diretor de projetos");
  });

  it("shows a dash read as Não informado when department or main function is missing", async () => {
    await renderWithProviders(
      <AccessTable
        rows={[buildMember({ name: "Eva Sem Dados", department: null, mainFunction: null })]}
      />,
    );

    const cells = within(screen.getByRole("row", { name: /Eva Sem Dados/ })).getAllByRole("cell");

    for (const cell of [cells[2], cells[3]]) {
      expect(within(cell).getByText("—")).toHaveAttribute("aria-hidden", "true");
      expect(within(cell).getByText("Não informado")).toHaveClass("sr-only");
    }
  });

  it("shows the dash in only the field that is missing", async () => {
    await renderWithProviders(<AccessTable rows={[PENDING]} />);

    const cells = within(screen.getByRole("row", { name: /Lucas Souza/ })).getAllByRole("cell");

    expect(cells[2]).toHaveTextContent("Tecnologia");
    expect(within(cells[2]).queryByText("Não informado")).not.toBeInTheDocument();
    expect(within(cells[3]).getByText("Não informado")).toBeInTheDocument();
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

  it("does not show the RA of the person", async () => {
    await renderWithProviders(<AccessTable rows={[buildMember({ ra: "2024RA0001" })]} />);

    expect(screen.queryByText("2024RA0001")).not.toBeInTheDocument();
  });

  it("shows a superadmin as Coordenadora", async () => {
    await renderWithProviders(
      <AccessTable rows={[buildMember({ name: "Dora Admin", role: Role.superadmin })]} />,
    );

    const row = screen.getByRole("row", { name: /Dora Admin/ });
    expect(within(row).getByText("Coordenadora")).toBeInTheDocument();
    expect(within(row).queryByText(/superadmin/i)).not.toBeInTheDocument();
  });

  it("shows no role badge when the person has no role", async () => {
    await renderWithProviders(
      <AccessTable rows={[buildMember({ name: "Eva Sem Papel", role: null })]} />,
    );

    const row = screen.getByRole("row", { name: /Eva Sem Papel/ });
    expect(within(row).getAllByRole("cell")[1]).toBeEmptyDOMElement();
  });

  it("shows Ativo, Inativo, A validar and Recusado", async () => {
    await renderWithProviders(<AccessTable rows={[...ROWS, PENDING, REJECTED]} />);

    expect(
      within(screen.getByRole("row", { name: /Ana Torres/ })).getByText("Ativo"),
    ).toBeVisible();
    expect(
      within(screen.getByRole("row", { name: /Beto Nunes/ })).getByText("Inativo"),
    ).toBeVisible();
    expect(
      within(screen.getByRole("row", { name: /Lucas Souza/ })).getByText("A validar"),
    ).toBeVisible();
    expect(
      within(screen.getByRole("row", { name: /Rita Lima/ })).getByText("Recusado"),
    ).toBeVisible();
  });

  it("colours the role and status badges by tone", async () => {
    await renderWithProviders(<AccessTable rows={[...ROWS, PENDING, REJECTED]} />);

    const ana = screen.getByRole("row", { name: /Ana Torres/ });
    expect(within(ana).getByText("Coordenadora")).toHaveClass("bg-tedi-highlight");
    expect(within(ana).getByText("Ativo")).toHaveClass("bg-tedi-badge-success");

    const beto = screen.getByRole("row", { name: /Beto Nunes/ });
    expect(within(beto).getByText("Diretor")).toHaveClass("bg-tedi-badge");
    expect(within(beto).getByText("Inativo")).toHaveClass("bg-tedi-neutral");

    const caio = screen.getByRole("row", { name: /Caio Lopes/ });
    expect(within(caio).getByText("Membro")).toHaveClass("bg-tedi-neutral");

    expect(
      within(screen.getByRole("row", { name: /Lucas Souza/ })).getByText("A validar"),
    ).toHaveClass("bg-tedi-warning");
    expect(
      within(screen.getByRole("row", { name: /Rita Lima/ })).getByText("Recusado"),
    ).toHaveClass("bg-danger-soft");
  });

  it("shows A validar and a Validar button on a pending registration", async () => {
    await renderWithProviders(<AccessTable rows={[PENDING]} onValidate={vi.fn()} />);

    const row = screen.getByRole("row", { name: /Lucas Souza/ });
    expect(within(row).getByText("A validar")).toBeInTheDocument();
    expect(
      within(row).getByRole("button", { name: "Validar cadastro de Lucas Souza" }),
    ).toHaveTextContent("Validar");
  });

  it("hides Validar without onValidate", async () => {
    await renderWithProviders(<AccessTable rows={[PENDING]} />);

    expect(
      within(screen.getByRole("row", { name: /Lucas Souza/ })).getByText("A validar"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Validar/ })).not.toBeInTheDocument();
  });

  it("offers Validar only on the rows waiting for validation", async () => {
    await renderWithProviders(
      <AccessTable rows={[...ROWS, PENDING, REJECTED]} onValidate={vi.fn()} />,
    );

    expect(screen.getAllByRole("button", { name: /^Validar/ })).toHaveLength(1);
    expect(
      within(screen.getByRole("row", { name: /Rita Lima/ })).queryByRole("button", {
        name: /^Validar/,
      }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /Ana Torres/ })).queryByRole("button", {
        name: /^Validar/,
      }),
    ).not.toBeInTheDocument();
  });

  it("reports the row when Validar is pressed", async () => {
    const onValidate = vi.fn();
    const user = userEvent.setup();
    await renderWithProviders(<AccessTable rows={[...ROWS, PENDING]} onValidate={onValidate} />);

    await user.click(screen.getByRole("button", { name: "Validar cadastro de Lucas Souza" }));

    expect(onValidate).toHaveBeenCalledTimes(1);
    expect(onValidate).toHaveBeenCalledWith(PENDING);
  });

  it("puts Validar after the link of the name and before the row actions in the tab order", async () => {
    const onValidate = vi.fn();
    const user = userEvent.setup();
    await renderWithProviders(<AccessTable rows={[PENDING]} onValidate={onValidate} />);

    await user.tab();
    expect(screen.getByRole("link", { name: "Lucas Souza" })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("button", { name: "Validar cadastro de Lucas Souza" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onValidate).toHaveBeenCalledWith(PENDING);

    await user.tab();
    expect(screen.getByRole("button", { name: "Ações de Lucas Souza" })).toHaveFocus();
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

  it("does not call onRowClick when Validar is clicked", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const onValidate = vi.fn();
    await renderWithProviders(
      <AccessTable rows={[PENDING]} onRowClick={onRowClick} onValidate={onValidate} />,
    );

    await user.click(screen.getByRole("button", { name: "Validar cadastro de Lucas Souza" }));

    expect(onValidate).toHaveBeenCalledExactlyOnceWith(PENDING);
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

    // The Departamento cell has nothing in it: the click lands on the cell, not on a control.
    const ana = screen.getByRole("row", { name: /Ana Torres/ });
    await expect(user.click(within(ana).getAllByRole("cell")[2])).resolves.toBeUndefined();

    expect(router.state.location.pathname).toBe("/");
  });
});
