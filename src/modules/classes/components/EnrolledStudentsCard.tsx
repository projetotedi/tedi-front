import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import type { ClassEnrollmentPreviewItemResponseDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import { DataTable, type Column } from "@shared/components/DataTable";
import { Card } from "@shared/ui";

import { formatInstantDate } from "../lib/format";
import { LINK_CLASSES } from "../lib/link-classes";

/** How many students the card shows. The API sends at most this many in `enrollmentsPreview`. */
const PREVIEW_LIMIT = 5;

export interface EnrolledStudentsCardProps {
  classId: string;
  /** `enrollmentsPreview` of the class: the earliest active enrollments, up to five. */
  preview: ClassEnrollmentPreviewItemResponseDto[];
  /** `enrollmentsTotal` of the class: all the active enrollments, not only the ones in `preview`. */
  total: number;
}

/**
 * "Alunos matriculados": the first students of the class, name and the day they enrolled, as the
 * preview of the API brings them (no age, status or attendance: the preview has only the name and
 * the date). "Ver todos os N ›" goes to the enrollment screen of the class (GUS-108, a "Em breve"
 * page until it exists), and only shows for who can manage enrollments and when there is someone
 * enrolled. A class with no enrollment says so, with no table.
 */
export function EnrolledStudentsCard({
  classId,
  preview,
  total,
}: EnrolledStudentsCardProps): ReactElement {
  const { t, i18n } = useTranslation("classes");
  const canManageEnrollments = useCan("enrollments.manage");
  const rows = preview.slice(0, PREVIEW_LIMIT);

  const columns: Column<ClassEnrollmentPreviewItemResponseDto>[] = [
    {
      header: t("detail.enrollments.name"),
      headerClassName: "uppercase",
      render: (enrollment) => enrollment.student.name,
    },
    {
      header: t("detail.enrollments.enrolledAt"),
      headerClassName: "uppercase md:whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
      render: (enrollment) => formatInstantDate(enrollment.enrolledAt, i18n.language),
    },
  ];

  return (
    <Card
      title={t("detail.enrollments.title")}
      aside={
        total > 0 && canManageEnrollments ? (
          <Link to={`/enrollments?classId=${classId}`} className={LINK_CLASSES}>
            {t("detail.enrollments.seeAll", { count: total })}
            <span aria-hidden="true">&nbsp;›</span>
          </Link>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <p className="text-base text-muted">{t("detail.enrollments.empty")}</p>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(enrollment) => enrollment.id}
          caption={t("detail.enrollments.caption")}
        />
      )}
    </Card>
  );
}
