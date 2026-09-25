import type { ReactNode } from "react";

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  /** Classes acrescentadas ao `th` da coluna (ex.: largura, caixa alta). */
  headerClassName?: string;
  /** Classes acrescentadas ao `td` da coluna (ex.: alinhamento). */
  cellClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Descrição da tabela para leitores de tela. */
  caption?: string;
  /** Mostrada em uma célula de largura total quando `rows` está vazio. */
  emptyMessage?: string;
  /** Classes acrescentadas ao `table` (ex.: `table-fixed min-w-[1245px]`). */
  tableClassName?: string;
}

function joinClasses(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

// A primeira e a última coluna encostam nas bordas do cartão; as do meio deixam 10px de cada lado
// (20px entre colunas, como no Figma).
const HEADER_CLASS = "px-2.5 pb-3 text-xs font-semibold text-muted first:pl-0 last:pr-0";
const CELL_CLASS = "px-2.5 py-2.5 text-base text-foreground first:pl-0 last:pr-0";

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  emptyMessage,
  tableClassName,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className={joinClasses("w-full text-left", tableClassName)}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                className={joinClasses(HEADER_CLASS, column.headerClassName)}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && emptyMessage ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-base text-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="border-t border-tedi-divider">
                {columns.map((column) => (
                  <td key={column.header} className={joinClasses(CELL_CLASS, column.cellClassName)}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
