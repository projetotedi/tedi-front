import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AccessResponseDto } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { AccessTable, type AccessTableProps } from "../components/AccessTable";
import { buildAccess, buildMeUser } from "./handlers";
import { renderSignedIn, setupAuthTestServer } from "./test-utils";

setupAuthTestServer();

const ROWS = [
  buildAccess({ id: "1", name: "Ana Torres", role: Role.coordinator, accessEnabled: true }),
  buildAccess({ id: "2", name: "Beto Nunes", role: Role.director, accessEnabled: false }),
  buildAccess({ id: "3", name: "Caio Lopes", role: Role.member, accessEnabled: true }),
];

const COORDINATOR = buildMeUser({ role: Role.coordinator });
const DIRECTOR = buildMeUser({ role: Role.director });

type TableOptions = Partial<AccessTableProps> & { me?: typeof COORDINATOR };

async function renderTable({ rows = ROWS, me = COORDINATOR, ...props }: TableOptions = {}) {
  const onEditMember = vi.fn<(row: AccessResponseDto) => void>();
  const view = await renderSignedIn(
    <AccessTable rows={rows} onEditMember={onEditMember} {...props} />,
    me,
  );
  await screen.findByRole("table", { name: "Membros com acesso ao TEDI" });
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

    expect(screen.getByRole("table", { name: "Membros com acesso ao TEDI" })).toBeInTheDocument();
  });

  it("leaves Departamento and Função principal empty", async () => {
    await renderTable();

    for (const row of screen.getAllByRole("row").slice(1)) {
      const cells = within(row).getAllByRole("cell");
      expect(cells).toHaveLength(6);
      expect(cells[2]).toBeEmptyDOMElement();
      expect(cells[3]).toBeEmptyDOMElement();
    }
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
      const onDeactivateMember = vi.fn<(row: AccessResponseDto) => void>();
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

      expect(screen.getByRole("button", { name: "Editar Ana Torres" })).toHaveFocus();
      expect(await screen.findByRole("tooltip")).toHaveTextContent("Editar");
    });

    it("the trash tooltip names the action", async () => {
      const user = userEvent.setup();
      await renderTable({ onDeactivateMember: vi.fn() });

      await user.tab();
      await user.tab();

      expect(screen.getByRole("button", { name: "Inativar Ana Torres" })).toHaveFocus();
      expect(await screen.findByRole("tooltip")).toHaveTextContent("Inativar membro");
    });

    it("each icon is one tab stop, in row order", async () => {
      const user = userEvent.setup();
      await renderTable();

      await user.tab();
      expect(screen.getByRole("button", { name: "Editar Ana Torres" })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole("button", { name: "Editar Beto Nunes" })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole("button", { name: "Editar Caio Lopes" })).toHaveFocus();
    });
  });

  describe("clickable rows", () => {
    it("clicking the row outside the icons calls onRowClick", async () => {
      const user = userEvent.setup();
      const onRowClick = vi.fn<(row: AccessResponseDto) => void>();
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

  it("does not show the RA nor the email of the person", async () => {
    await renderTable({
      rows: [buildAccess({ ra: "2024RA0001", email: "ana@example.com" })],
    });

    expect(screen.queryByText("2024RA0001")).not.toBeInTheDocument();
    expect(screen.queryByText("ana@example.com")).not.toBeInTheDocument();
  });

  it("shows a superadmin as Coordenadora", async () => {
    await renderTable({ rows: [buildAccess({ name: "Dora Admin", role: Role.superadmin })] });

    const row = screen.getByRole("row", { name: /Dora Admin/ });
    expect(within(row).getByText("Coordenadora")).toBeInTheDocument();
    expect(within(row).queryByText(/superadmin/i)).not.toBeInTheDocument();
  });

  it("shows no role badge when the person has no role", async () => {
    await renderTable({ rows: [buildAccess({ name: "Eva Sem Papel", role: null })] });

    const row = screen.getByRole("row", { name: /Eva Sem Papel/ });
    expect(within(row).getAllByRole("cell")[1]).toBeEmptyDOMElement();
  });

  it("colours the role and status badges by tone", async () => {
    await renderTable();

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
    await renderTable({ rows: [] });

    expect(screen.getAllByRole("columnheader")).toHaveLength(6);
    expect(screen.queryAllByRole("cell")).toHaveLength(0);
  });
});
