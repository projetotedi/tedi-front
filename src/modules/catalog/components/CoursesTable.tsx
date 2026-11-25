import type { ReactElement } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { CourseStatus, type CourseListItemDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import { DataTable, type Column } from "@shared/components/DataTable";
import pencilIcon from "@shared/assets/icons/pencil.svg";
import trashBinIcon from "@shared/assets/icons/trash-bin.svg";
import { formatHours } from "@shared/lib/format";
import { Badge, Button } from "@shared/ui";

export interface CoursesTableProps {
  courses: CourseListItemDto[];
  /** Classes (not archived) of each course of the page; a course missing from it shows a dash. */
  classCounts: Map<string, number>;
  caption: string;
  onEdit: (course: CourseListItemDto) => void;
  onArchive: (course: CourseListItemDto) => void;
  onUnarchive: (course: CourseListItemDto) => void;
}

/**
 * The table of the list of courses (GUS-131), with the columns of the Figma. The whole row opens
 * the course (the hover of `DataTable`); the name stays a link for the keyboard and the screen
 * reader, and the buttons of the row do not open it (`DataTable` skips clicks on them).
 *
 * The column Ações is there only for director and coordination: the pencil (`courses.manage`)
 * opens Editar curso (GUS-129) and is off for an archived course, which is read-only (RN-27); the
 * bin (`courses.duplicateArchive`) opens Arquivar curso, and an archived course shows Reativar
 * instead. Each icon button has the name of its action and of the course.
 */
export function CoursesTable({
  courses,
  classCounts,
  caption,
  onEdit,
  onArchive,
  onUnarchive,
}: CoursesTableProps): ReactElement {
  const { t } = useTranslation("catalog");
  const navigate = useNavigate();
  const canArchive = useCan("courses.duplicateArchive");
  const canManage = useCan("courses.manage");

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
    ...(canArchive || canManage
      ? [
          {
            header: t("courses.columns.actions"),
            render: (course: CourseListItemDto) => (
              <div className="flex items-center gap-1">
                {canManage ? (
                  <Button
                    variant="ghost"
                    isIconOnly
                    aria-label={t("courses.actions.edit", { name: course.name })}
                    isDisabled={course.status === CourseStatus.archived}
                    onPress={() => onEdit(course)}
                  >
                    <img
                      src={pencilIcon}
                      alt=""
                      aria-hidden="true"
                      width={16}
                      height={16}
                      title={t("course.form.editAction")}
                    />
                  </Button>
                ) : null}
                {canArchive ? renderArchiveAction(course) : null}
              </div>
            ),
          } satisfies Column<CourseListItemDto>,
        ]
      : []),
  ];

  function renderArchiveAction(course: CourseListItemDto): ReactElement {
    return course.status === CourseStatus.archived ? (
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
    );
  }

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
