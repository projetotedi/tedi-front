import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import type {
  StudentByEnrollmentItemResponseDto,
  StudentListItemResponseDto,
} from "@api/generated/model";
import { DataTable, type Column } from "@shared/components/DataTable";
import pencilIcon from "@shared/assets/icons/pencil.svg";
import trashBinIcon from "@shared/assets/icons/trash-bin.svg";
import { Badge, Button } from "@shared/ui";

import { formatPhone } from "../lib/format";
import { EmptyValue } from "./EmptyValue";
import { LINK_CLASSES } from "./link-classes";

const CLICKABLE_ROW_CLASS =
  "hover:shadow-[inset_3px_0_0_var(--accent)] focus-within:shadow-[inset_3px_0_0_var(--accent)]";

type StudentRow = StudentListItemResponseDto | StudentByEnrollmentItemResponseDto;

export interface StudentsTableProps {
  students: StudentRow[];
  caption: string;
  /** The pencil (Editar dados), for who has `students.manage`. */
  onEdit?: (student: StudentRow) => void;
  /** The bin (Arquivar aluno), for who has `students.archive`. */
  onArchive?: (student: StudentRow) => void;
}

function classesOf(student: StudentRow) {
  return "currentClasses" in student ? student.currentClasses : null;
}

/**
 * The table of the students (GUS-137, Figma): name (a link to the record, for the keyboard and the
 * screen reader), age, class and situation, and the phone. The whole row opens the record too, with
 * the highlight of the Figma. Turma and Situação come from the list by enrollment; the plain list
 * (`listStudents`) does not know the classes, so they are "—" there. Ações has the pencil and the
 * bin (GUS-123), each only when the page passes its handler, and the column only when there is one.
 */
export function StudentsTable({
  students,
  caption,
  onEdit,
  onArchive,
}: StudentsTableProps): ReactElement {
  const { t } = useTranslation("people");
  const navigate = useNavigate();

  const columns: Column<StudentRow>[] = [
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

  if (onEdit || onArchive) {
    columns.push({
      header: t("students.columns.actions"),
      headerClassName: "uppercase",
      render: (student) => (
        <div className="flex items-center gap-1">
          {onEdit ? (
            <Button
              variant="ghost"
              isIconOnly
              aria-label={t("students.row.edit", { name: student.name })}
              onPress={() => onEdit(student)}
            >
              <img src={pencilIcon} alt="" aria-hidden="true" width={16} height={16} />
            </Button>
          ) : null}
          {onArchive ? (
            <Button
              variant="ghost"
              isIconOnly
              aria-label={t("students.row.archive", { name: student.name })}
              onPress={() => onArchive(student)}
            >
              <img src={trashBinIcon} alt="" aria-hidden="true" width={16} height={16} />
            </Button>
          ) : null}
        </div>
      ),
    });
  }

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
