import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { AccessibilityNeed, type StudentDetailDto } from "@api/generated/model";
import { DataTable, type Column } from "@shared/components/DataTable";
import { Badge, Card } from "@shared/ui";

import { hasAccessibilityRecord } from "../lib/student";
import { EmptyValue } from "./EmptyValue";

export interface StudentAccessibilityCardProps {
  student: StudentDetailDto;
}

/** The text of a cell, or the `EmptyValue` when the registration left it empty or blank. */
function textOrEmpty(value: string | null): ReactNode {
  return value !== null && value.trim() !== "" ? value : <EmptyValue />;
}

/**
 * "Necessidades de acessibilidade": a table with the category, what the person needs in class, the
 * support resource and who registered it, as in the Figma. A student has at most one record, so the
 * table has at most one row. It has none when the category is `none` and nothing is written, and
 * then the card says so under the headers (the headers stay in every case). A `none` category with
 * text written still has its row, with "Nenhuma" in the category: hiding it would hide what the
 * coordination typed.
 *
 * "Registrado por" is the `createdBy` of the student: the DTO has no author of the accessibility
 * record by itself. This is health data (LGPD) and, like the rest of the page, it only reaches the
 * screen for whoever has `students.view`; the API is the one that authorizes.
 */
export function StudentAccessibilityCard({ student }: StudentAccessibilityCardProps): ReactElement {
  const { t } = useTranslation("people");
  const title = t("student.accessibility.title");

  const columns: Column<StudentDetailDto>[] = [
    {
      header: t("student.accessibility.columns.category"),
      render: (row) => (
        <Badge tone={row.accessibilityNeed === AccessibilityNeed.none ? "neutral" : "highlight"}>
          {t(`student.accessibilityNeed.${row.accessibilityNeed}`)}
        </Badge>
      ),
      headerClassName: "text-sm uppercase",
    },
    {
      header: t("student.accessibility.columns.classNeeds"),
      render: (row) => textOrEmpty(row.classNeeds),
      headerClassName: "text-sm uppercase",
      cellClassName: "break-words",
    },
    {
      header: t("student.accessibility.columns.supportResource"),
      render: (row) => textOrEmpty(row.supportResource),
      headerClassName: "text-sm uppercase",
      cellClassName: "break-words",
    },
    {
      header: t("student.accessibility.columns.registeredBy"),
      render: (row) => textOrEmpty(row.createdBy?.name ?? null),
      headerClassName: "text-sm uppercase",
      cellClassName: "break-words",
    },
  ];

  return (
    <Card title={title}>
      <DataTable
        caption={title}
        columns={columns}
        rows={hasAccessibilityRecord(student) ? [student] : []}
        rowKey={(row) => row.id}
        emptyMessage={t("student.accessibility.empty")}
      />
    </Card>
  );
}
