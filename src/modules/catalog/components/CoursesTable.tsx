import type { ReactElement } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { CourseStatus, type CourseListItemDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import { DataTable, type Column } from "@shared/components/DataTable";
import trashBinIcon from "@shared/assets/icons/trash-bin.svg";
import { formatHours } from "@shared/lib/format";
import { Badge, Button } from "@shared/ui";

export interface CoursesTableProps {
  courses: CourseListItemDto[];
  /** Classes (not archived) of each course of the page; a course missing from it shows a dash. */
  classCounts: Map<string, number>;
  caption: string;
  onArchive: (course: CourseListItemDto) => void;
  onUnarchive: (course: CourseListItemDto) => void;
}

/**
 * The table of the list of courses (GUS-131), with the columns of the Figma. The whole row opens
 * the course (the hover of `DataTable`); the name stays a link for the keyboard and the screen
 * reader, and the buttons of the row do not open it (`DataTable` skips clicks on them).
 *
 * The column Ações is there only for who has `courses.duplicateArchive` (director and
 * coordination): the bin opens Arquivar curso; an archived course shows Reativar instead. The pencil
 * of the Figma (Editar curso) comes with the form of GUS-129.
 */
export function CoursesTable({
  courses,
  classCounts,
  caption,
  onArchive,
  onUnarchive,
}: CoursesTableProps): ReactElement {
  const { t } = useTranslation("catalog");
  const navigate = useNavigate();
  const canArchive = useCan("courses.duplicateArchive");

  const columns: Column<CourseListItemDto>[] = [
    {
      header: t("courses.columns.course"),
      render: (course) => (
        <Link
          to={`/courses/${course.id}`}
          className="font-medium text-foreground hover:underline focus-visible:underline"
        >
          {course.name}
        </Link>
      ),
    },
    {
      header: t("courses.columns.category"),
      render: (course) => <Badge tone="neutral">{t(`category.${course.category}`)}</Badge>,
    },
    {
      header: t("courses.columns.lessonPlans"),
      cellClassName: "whitespace-nowrap",
      render: (course) => course.lessonPlanCount,
    },
    {
      header: t("courses.columns.workload"),
      cellClassName: "whitespace-nowrap",
      render: (course) => formatHours(course.plannedWorkloadMinutes),
    },
    {
      header: t("courses.columns.prerequisite"),
      render: (course) =>
        course.prerequisites.length === 0 ? (
          <span aria-label={t("course.notInformed")}>-</span>
        ) : (
          course.prerequisites.map((prerequisite) => prerequisite.name).join(", ")
        ),
    },
    {
      header: t("courses.columns.classes"),
      cellClassName: "whitespace-nowrap",
      render: (course) => classCounts.get(course.id) ?? "—",
    },
    {
      header: t("courses.columns.status"),
      render: (course) =>
        course.status === CourseStatus.archived ? (
          <Badge tone="neutral">{t("course.status.archived")}</Badge>
        ) : (
          <Badge tone="success">{t("course.status.active")}</Badge>
        ),
    },
    ...(canArchive
      ? [
          {
            header: t("courses.columns.actions"),
            render: (course: CourseListItemDto) =>
              course.status === CourseStatus.archived ? (
                <Button
                  variant="ghost"
                  aria-label={t("courses.actions.unarchive", { name: course.name })}
                  onPress={() => onUnarchive(course)}
                >
                  {t("courses.actions.unarchiveShort")}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  isIconOnly
                  aria-label={t("courses.actions.archive", { name: course.name })}
                  onPress={() => onArchive(course)}
                >
                  <img
                    src={trashBinIcon}
                    alt=""
                    aria-hidden="true"
                    width={16}
                    height={16}
                    title={t("course.archive.action")}
                  />
                </Button>
              ),
          } satisfies Column<CourseListItemDto>,
        ]
      : []),
  ];

  return (
    <DataTable
      columns={columns}
      rows={courses}
      rowKey={(course) => course.id}
      onRowClick={(course) => void navigate(`/courses/${course.id}`)}
      caption={caption}
    />
  );
}
