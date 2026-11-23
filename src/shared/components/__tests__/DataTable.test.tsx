import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";

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

  it("scrolls sideways inside its own box, which holds the sr-only texts so they cannot widen the page", () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={[{ id: "1", name: "Ana" }]}
        rowKey={(row) => row.id}
        caption="Lista de pessoas"
      />,
    );

    // `sr-only` is positioned absolutely: it is clipped by the scroller only if the scroller is
    // positioned (its containing block).
    expect(screen.getByRole("table").parentElement).toHaveClass("relative", "overflow-x-auto");
  });

  it("renders no rows and no message when rows is empty and emptyMessage is not set", () => {
    render(<DataTable columns={COLUMNS} rows={[]} rowKey={(row) => row.id} />);

    expect(screen.queryAllByRole("cell")).toHaveLength(0);
  });

  describe("onRowClick", () => {
    const ROW: Row = { id: "1", name: "Ana" };

    it("is called with the row when a cell is clicked", async () => {
      const onRowClick = vi.fn();
      render(
        <DataTable
          columns={COLUMNS}
          rows={[ROW]}
          rowKey={(row) => row.id}
          onRowClick={onRowClick}
        />,
      );

      await userEvent.click(screen.getByRole("cell", { name: "Ana" }));

      expect(onRowClick).toHaveBeenCalledExactlyOnceWith(ROW);
    });

    it("ignores a click on a button or a link inside the row", async () => {
      const onRowClick = vi.fn();
      render(
        <DataTable
          columns={[
            {
              header: "Nome",
              render: (row: Row) => (
                <>
                  <button type="button">Editar {row.name}</button>
                  <a href="#detail">Abrir {row.name}</a>
                </>
              ),
            },
          ]}
          rows={[ROW]}
          rowKey={(row) => row.id}
          onRowClick={onRowClick}
        />,
      );

      await userEvent.click(screen.getByRole("button", { name: "Editar Ana" }));
      await userEvent.click(screen.getByRole("link", { name: "Abrir Ana" }));

      expect(onRowClick).not.toHaveBeenCalled();
    });

    it("ignores a click that comes from a portal rendered inside a cell", async () => {
      const onRowClick = vi.fn();
      render(
        <DataTable
          columns={[
            {
              header: "Nome",
              // What a cell does to show a dialog or a menu: it renders in `document.body`,
              // outside the row, and React sends the click up through the cell to the row.
              render: () => createPortal(<p>dentro do diálogo</p>, document.body),
            },
          ]}
          rows={[ROW]}
          rowKey={(row) => row.id}
          onRowClick={onRowClick}
        />,
      );

      await userEvent.click(screen.getByText("dentro do diálogo"));

      expect(onRowClick).not.toHaveBeenCalled();
    });
  });
});
