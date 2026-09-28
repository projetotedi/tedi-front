import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataTable, type Column } from "../DataTable";

interface Row {
  id: string;
  name: string;
}

const COLUMNS: Column<Row>[] = [{ header: "Nome", render: (row) => row.name }];

describe("DataTable", () => {
  it("renders caption and column headers with scope", () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={[{ id: "1", name: "Ana" }]}
        rowKey={(row) => row.id}
        caption="Lista de pessoas"
      />,
    );

    expect(screen.getByText("Lista de pessoas")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Nome" })).toHaveAttribute("scope", "col");
    expect(screen.getByRole("cell", { name: "Ana" })).toBeInTheDocument();
  });

  it("shows emptyMessage in a full-width cell when there are no rows", () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={[]}
        rowKey={(row) => row.id}
        caption="Lista de pessoas"
        emptyMessage="Nenhum acesso encontrado"
      />,
    );

    const cell = screen.getByRole("cell", { name: "Nenhum acesso encontrado" });
    expect(cell).toHaveAttribute("colspan", "1");
    expect(screen.getByRole("columnheader", { name: "Nome" })).toBeInTheDocument();
  });

  it("applies per-column header and cell classes and the table class", () => {
    render(
      <DataTable
        columns={[
          {
            header: "Nome",
            render: (row: Row) => row.name,
            headerClassName: "w-40 uppercase",
            cellClassName: "text-right",
          },
          { header: "Código", render: (row: Row) => row.id },
        ]}
        rows={[{ id: "1", name: "Ana" }]}
        rowKey={(row) => row.id}
        tableClassName="table-fixed min-w-[600px]"
      />,
    );

    expect(screen.getByRole("columnheader", { name: "Nome" })).toHaveClass("w-40", "uppercase");
    expect(screen.getByRole("cell", { name: "Ana" })).toHaveClass("text-right");
    expect(screen.getByRole("table")).toHaveClass("table-fixed", "min-w-[600px]", "w-full");
  });

  it("keeps the default header and cell styles when a column adds its own classes", () => {
    render(
      <DataTable
        columns={[
          {
            header: "Nome",
            render: (row: Row) => row.name,
            headerClassName: "w-40",
            cellClassName: "text-right",
          },
        ]}
        rows={[{ id: "1", name: "Ana" }]}
        rowKey={(row) => row.id}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "Nome" })).toHaveClass(
      "text-xs",
      "font-semibold",
      "text-muted",
    );
    expect(screen.getByRole("cell", { name: "Ana" })).toHaveClass("text-base", "text-foreground");
  });

  it("renders no rows and no message when rows is empty and emptyMessage is not set", () => {
    render(<DataTable columns={COLUMNS} rows={[]} rowKey={(row) => row.id} />);

    expect(screen.queryAllByRole("cell")).toHaveLength(0);
  });
});
