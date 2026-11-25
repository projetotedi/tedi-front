import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  MemberRegistrationStatus,
  MemberStatus,
  type MemberListItemResponseDto,
} from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { AccessTable, type AccessTableProps } from "../components/AccessTable";
import { buildMember, buildMeUser } from "./handlers";
import { renderSignedIn, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

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

const COORDINATOR = buildMeUser({ role: Role.coordinator });
const DIRECTOR = buildMeUser({ role: Role.director });

type TableOptions = Partial<AccessTableProps> & { me?: typeof COORDINATOR };

async function renderTable({ rows = ROWS, me = COORDINATOR, ...props }: TableOptions = {}) {
  const onEditMember = vi.fn<(row: MemberListItemResponseDto) => void>();
  const view = await renderSignedIn(
    <AccessTable rows={rows} onEditMember={onEditMember} {...props} />,
    me,
  );
  await screen.findByRole("table", { name: "Membros do TEDI" });
  return { ...view, onEditMember };
}

describe("AccessTable", () => {
  it("renders one row per person with name, translated role and status", async () => {
    await renderTable();

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
    await renderTable();

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
    await renderTable();

    expect(screen.getByRole("table", { name: "Membros do TEDI" })).toBeInTheDocument();
  });

  it("shows the department name and the main function", async () => {
    await renderTable();

    const ana = within(screen.getByRole("row", { name: /Ana Torres/ })).getAllByRole("cell");
    expect(ana[2]).toHaveTextContent("Pedagogia");
    expect(ana[3]).toHaveTextContent("Monitora");

    const beto = within(screen.getByRole("row", { name: /Beto Nunes/ })).getAllByRole("cell");
    expect(beto[2]).toHaveTextContent("Tecnologia");
    expect(beto[3]).toHaveTextContent("Diretor de projetos");
  });

  it("shows a dash read as Não informado when department or main function is missing", async () => {
    await renderTable({
      rows: [buildMember({ name: "Eva Sem Dados", department: null, mainFunction: null })],
    });

    const cells = within(screen.getByRole("row", { name: /Eva Sem Dados/ })).getAllByRole("cell");

    for (const cell of [cells[2], cells[3]]) {
      expect(within(cell).getByText("—")).toHaveAttribute("aria-hidden", "true");
      expect(within(cell).getByText("Não informado")).toHaveClass("sr-only");
    }
  });

  it("shows the dash in only the field that is missing", async () => {
    await renderTable({ rows: [PENDING] });

    const cells = within(screen.getByRole("row", { name: /Lucas Souza/ })).getAllByRole("cell");

    expect(cells[2]).toHaveTextContent("Tecnologia");
    expect(within(cells[2]).queryByText("Não informado")).not.toBeInTheDocument();
    expect(within(cells[3]).getByText("Não informado")).toBeInTheDocument();
  });

  it("does not render the kebab button anymore", async () => {
    await renderTable();

    expect(screen.queryByRole("button", { name: /Ações de/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    for (const row of screen.getAllByRole("row").slice(1)) {
      expect(row.querySelector("svg")).toBeNull();
    }
  });

  describe("row actions", () => {
    it("coordinator sees the pencil on every row, named after the person", async () => {
      await renderTable();

      for (const name of ["Ana Torres", "Beto Nunes", "Caio Lopes"]) {
        const row = screen.getByRole("row", { name: new RegExp(name) });
        expect(within(row).getByRole("button", { name: `Editar ${name}` })).toBeInTheDocument();
      }
      expect(screen.getAllByRole("button")).toHaveLength(ROWS.length);
    });

    it("pencil calls onEditMember with the row", async () => {
      const user = userEvent.setup();
      const { onEditMember } = await renderTable();

      await user.click(screen.getByRole("button", { name: "Editar Beto Nunes" }));

      expect(onEditMember).toHaveBeenCalledTimes(1);
      expect(onEditMember).toHaveBeenCalledWith(ROWS[1]);
    });

    it("the pencil has a 44px target with a decorative 16px icon", async () => {
      await renderTable();

      const pencil = screen.getByRole("button", { name: "Editar Ana Torres" });
      expect(pencil).toHaveClass("min-h-11", "min-w-11");
      const icon = pencil.querySelector("img");
      expect(icon).toHaveAttribute("alt", "");
      expect(icon).toHaveAttribute("aria-hidden", "true");
      expect(icon).toHaveAttribute("width", "16");
      expect(icon).toHaveAttribute("height", "16");
    });

    it("shows the trash only when onDeactivateMember is wired and the user can deactivate members", async () => {
      const { unmount } = await renderTable();
      expect(screen.queryByRole("button", { name: /Inativar/ })).not.toBeInTheDocument();
      unmount();

      const user = userEvent.setup();
      const onDeactivateMember = vi.fn<(row: MemberListItemResponseDto) => void>();
      await renderTable({ onDeactivateMember });

      for (const name of ["Ana Torres", "Beto Nunes", "Caio Lopes"]) {
        const row = screen.getByRole("row", { name: new RegExp(name) });
        expect(within(row).getByRole("button", { name: `Inativar ${name}` })).toBeInTheDocument();
      }

      await user.click(screen.getByRole("button", { name: "Inativar Caio Lopes" }));
      expect(onDeactivateMember).toHaveBeenCalledWith(ROWS[2]);
    });

    it("director sees no trash even when onDeactivateMember is wired", async () => {
      await renderTable({ me: DIRECTOR, onDeactivateMember: vi.fn() });

      expect(screen.queryByRole("button", { name: /Inativar/ })).not.toBeInTheDocument();
    });

    it("director sees no pencil because the list brings no per-row grant yet", async () => {
      await renderTable({ me: DIRECTOR });

      expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
      expect(screen.queryAllByRole("button")).toHaveLength(0);
    });

    it("edit tooltip appears on keyboard focus", async () => {
      const user = userEvent.setup();
      await renderTable();

      await user.tab();
      await user.tab();

      expect(screen.getByRole("button", { name: "Editar Ana Torres" })).toHaveFocus();
      expect(await screen.findByRole("tooltip")).toHaveTextContent("Editar");
    });

    it("the trash tooltip names the action", async () => {
      const user = userEvent.setup();
      await renderTable({ onDeactivateMember: vi.fn() });

      await user.tab();
      await user.tab();
      await user.tab();

      expect(screen.getByRole("button", { name: "Inativar Ana Torres" })).toHaveFocus();
      expect(await screen.findByRole("tooltip")).toHaveTextContent("Inativar membro");
    });

    it("each icon is one tab stop, after the link of the name, in row order", async () => {
      const user = userEvent.setup();
      await renderTable();

      await user.tab();
      expect(screen.getByRole("link", { name: "Ana Torres" })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole("button", { name: "Editar Ana Torres" })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole("link", { name: "Beto Nunes" })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole("button", { name: "Editar Beto Nunes" })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole("link", { name: "Caio Lopes" })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole("button", { name: "Editar Caio Lopes" })).toHaveFocus();
    });
  });

  describe("clickable rows", () => {
    it("clicking the row outside the icons calls onRowClick", async () => {
      const user = userEvent.setup();
      const onRowClick = vi.fn<(row: MemberListItemResponseDto) => void>();
      await renderTable({ onRowClick });

      await user.click(
        within(screen.getByRole("row", { name: /Beto Nunes/ })).getByText("Diretor"),
      );

      expect(onRowClick).toHaveBeenCalledTimes(1);
      expect(onRowClick).toHaveBeenCalledWith(ROWS[1]);
    });

    it("clicking the pencil does not call onRowClick", async () => {
      const user = userEvent.setup();
      const onRowClick = vi.fn();
      const { onEditMember } = await renderTable({ onRowClick });

      await user.click(screen.getByRole("button", { name: "Editar Beto Nunes" }));

      expect(onEditMember).toHaveBeenCalledTimes(1);
      expect(onRowClick).not.toHaveBeenCalled();
    });

    it("clicking the trash does not call onRowClick", async () => {
      const user = userEvent.setup();
      const onRowClick = vi.fn();
      const onDeactivateMember = vi.fn();
      await renderTable({ onRowClick, onDeactivateMember });

      await user.click(screen.getByRole("button", { name: "Inativar Beto Nunes" }));

      expect(onDeactivateMember).toHaveBeenCalledTimes(1);
      expect(onRowClick).not.toHaveBeenCalled();
    });

    it("draws the hover highlight and the 3px bar only when the row is clickable", async () => {
      const { unmount } = await renderTable();
      const plainRow = screen.getByRole("row", { name: /Ana Torres/ });
      expect(plainRow).not.toHaveClass("cursor-pointer");
      expect(plainRow.className).not.toContain("inset_3px_0_0");
      unmount();

      await renderTable({ onRowClick: vi.fn() });
      const clickableRow = screen.getByRole("row", { name: /Ana Torres/ });
      expect(clickableRow).toHaveClass("cursor-pointer", "hover:bg-tedi-info-subtle");
      expect(clickableRow.className).toContain("hover:shadow-[inset_3px_0_0_var(--accent)]");
    });
  });

  it("does not show the RA of the person", async () => {
    await renderTable({ rows: [buildMember({ ra: "2024RA0001" })] });

    expect(screen.queryByText("2024RA0001")).not.toBeInTheDocument();
  });

  it("shows a superadmin as Coordenadora", async () => {
    await renderTable({ rows: [buildMember({ name: "Dora Admin", role: Role.superadmin })] });

    const row = screen.getByRole("row", { name: /Dora Admin/ });
    expect(within(row).getByText("Coordenadora")).toBeInTheDocument();
    expect(within(row).queryByText(/superadmin/i)).not.toBeInTheDocument();
  });

  it("shows no role badge when the person has no role", async () => {
    await renderTable({ rows: [buildMember({ name: "Eva Sem Papel", role: null })] });

    const row = screen.getByRole("row", { name: /Eva Sem Papel/ });
    expect(within(row).getAllByRole("cell")[1]).toBeEmptyDOMElement();
  });

  it("shows Ativo, Inativo, A validar and Recusado", async () => {
    await renderTable({ rows: [...ROWS, PENDING, REJECTED] });

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
    await renderTable({ rows: [...ROWS, PENDING, REJECTED] });

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
    await renderTable({ rows: [PENDING], onValidate: vi.fn() });

    const row = screen.getByRole("row", { name: /Lucas Souza/ });
    expect(within(row).getByText("A validar")).toBeInTheDocument();
    expect(
      within(row).getByRole("button", { name: "Validar cadastro de Lucas Souza" }),
    ).toHaveTextContent("Validar");
  });

  it("hides Validar without onValidate", async () => {
    await renderTable({ rows: [PENDING] });

    expect(
      within(screen.getByRole("row", { name: /Lucas Souza/ })).getByText("A validar"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Validar/ })).not.toBeInTheDocument();
  });

  it("offers Validar only on the rows waiting for validation", async () => {
    await renderTable({ rows: [...ROWS, PENDING, REJECTED], onValidate: vi.fn() });

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
    await renderTable({ rows: [...ROWS, PENDING], onValidate });

    await user.click(screen.getByRole("button", { name: "Validar cadastro de Lucas Souza" }));

    expect(onValidate).toHaveBeenCalledTimes(1);
    expect(onValidate).toHaveBeenCalledWith(PENDING);
  });

  it("puts Validar after the link of the name and before the row actions in the tab order", async () => {
    const onValidate = vi.fn();
    const user = userEvent.setup();
    await renderTable({ rows: [PENDING], onValidate });

    await user.tab();
    expect(screen.getByRole("link", { name: "Lucas Souza" })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("button", { name: "Validar cadastro de Lucas Souza" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onValidate).toHaveBeenCalledWith(PENDING);

    await user.tab();
    expect(screen.getByRole("button", { name: "Editar Lucas Souza" })).toHaveFocus();
  });

  it("keeps the column headers and draws no row when there are no people", async () => {
    await renderTable({ rows: [] });

    expect(screen.getAllByRole("columnheader")).toHaveLength(6);
    expect(screen.queryAllByRole("cell")).toHaveLength(0);
  });

  it("renders the name as a link to /members/:id", async () => {
    await renderTable();

    for (const { id, name } of ROWS) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", `/members/${id}`);
    }
    expect(screen.getAllByRole("link")).toHaveLength(ROWS.length);
  });

  it("opens the member with the keyboard, from the link of the name", async () => {
    const user = userEvent.setup();
    const { router } = await renderTable();

    await user.tab();
    await user.keyboard("{Enter}");

    expect(router.state.location.pathname).toBe("/members/1");
  });

  it("calls onRowClick when a cell of the row is clicked", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    await renderTable({ onRowClick });

    const beto = screen.getByRole("row", { name: /Beto Nunes/ });
    await user.click(within(beto).getAllByRole("cell")[2]);

    expect(onRowClick).toHaveBeenCalledExactlyOnceWith(ROWS[1]);
  });

  it("calls onRowClick when the badge of the status is clicked", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    await renderTable({ onRowClick });

    const caio = screen.getByRole("row", { name: /Caio Lopes/ });
    await user.click(within(caio).getByText("Ativo"));

    expect(onRowClick).toHaveBeenCalledExactlyOnceWith(ROWS[2]);
  });

  it("does not call onRowClick when Validar is clicked", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const onValidate = vi.fn();
    await renderTable({ rows: [PENDING], onRowClick, onValidate });

    await user.click(screen.getByRole("button", { name: "Validar cadastro de Lucas Souza" }));

    expect(onValidate).toHaveBeenCalledExactlyOnceWith(PENDING);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("does not call onRowClick when the link of the name is clicked: the link opens the member itself", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const { router } = await renderTable({ onRowClick });

    await user.click(screen.getByRole("link", { name: "Caio Lopes" }));

    expect(onRowClick).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/members/3");
  });

  it("is not clickable without onRowClick", async () => {
    const user = userEvent.setup();
    const { router } = await renderTable();

    const ana = screen.getByRole("row", { name: /Ana Torres/ });
    await expect(user.click(within(ana).getAllByRole("cell")[2])).resolves.toBeUndefined();

    expect(router.state.location.pathname).toBe("/");
  });
});
