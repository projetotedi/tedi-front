import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import type {
  StudentByEnrollmentItemResponseDto,
  StudentListItemResponseDto,
} from "@api/generated/model";
import { DataTable, type Column } from "@shared/components/DataTable";
import { Badge } from "@shared/ui";

import { formatPhone } from "../lib/format";
import { EmptyValue } from "./EmptyValue";
import { LINK_CLASSES } from "./link-classes";

const CLICKABLE_ROW_CLASS =
  "hover:shadow-[inset_3px_0_0_var(--accent)] focus-within:shadow-[inset_3px_0_0_var(--accent)]";

export interface StudentsTableProps {
  students: (StudentListItemResponseDto | StudentByEnrollmentItemResponseDto)[];
  caption: string;
}

function classesOf(student: StudentsTableProps["students"][number]) {
  return "currentClasses" in student ? student.currentClasses : null;
}

/**
 * The table of the students (GUS-137, Figma): name (a link to the record, for the keyboard and the
 * screen reader), age, class and situation, and the phone. The whole row opens the record too, with
 * the highlight of the Figma. Turma and Situação come from the list by enrollment; the plain list
 * (`listStudents`) does not know the classes, so they are "—" there. The pencil and the bin come
 * with GUS-123.
 */
export function StudentsTable({ students, caption }: StudentsTableProps): ReactElement {
  const { t } = useTranslation("people");
  const navigate = useNavigate();

  const columns: Column<StudentsTableProps["students"][number]>[] = [
    {
      header: t("students.columns.name"),
      headerClassName: "uppercase",
      render: (student) => (
        <Link
          to={`/students/${student.id}`}
          className={LINK_CLASSES}
          onClick={(event) => event.stopPropagation()}
        >
          {student.name}
        </Link>
      ),
    },
    {
      header: t("students.columns.age"),
      headerClassName: "uppercase",
      render: (student) => student.age,
    },
    {
      header: t("students.columns.class"),
      headerClassName: "uppercase",
      render: (student) => {
        const classes = classesOf(student);
        return classes && classes.length > 0 ? (
          classes.map((schoolClass) => schoolClass.name ?? schoolClass.code).join(", ")
        ) : (
          <EmptyValue />
        );
      },
    },
    {
      header: t("students.columns.situation"),
      headerClassName: "uppercase",
      render: (student) => {
        const classes = classesOf(student);
        if (classes === null) return <EmptyValue />;
        return classes.length > 0 ? (
          <Badge tone="success">{t("students.situation.enrolled")}</Badge>
        ) : (
          <Badge tone="neutral">{t("students.situation.not_enrolled")}</Badge>
        );
      },
    },
    {
      header: t("students.columns.contact"),
      headerClassName: "uppercase",
      cellClassName: "whitespace-nowrap",
      render: (student) => (student.phone ? formatPhone(student.phone) : <EmptyValue />),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={students}
      rowKey={(student) => student.id}
      onRowClick={(student) => navigate(`/students/${student.id}`)}
      rowClassName={CLICKABLE_ROW_CLASS}
      caption={caption}
    />
  );
}
