import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import type { LessonListItemResponseDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import { DataTable, type Column } from "@shared/components/DataTable";
import { formatCalendarDate } from "@shared/lib/format";
import { Badge } from "@shared/ui";

import { lessonDetailPath } from "../lib/lesson-paths";
import { LESSON_STATUS_LABEL_KEYS, lessonStatusTone } from "../lib/lesson-status";
import { LessonRowActions } from "./LessonRowActions";
import { LINK_CLASSES } from "./link-classes";

export interface LessonsTableProps {
  lessons: LessonListItemResponseDto[];
  caption: string;
}

/**
 * The first column starts 12px in, so the 3px bar that shows on the row (hover and focus) does not
 * cover the first letter. The `!` is there because the default of the table, no padding at the
 * start of the first column, would otherwise win.
 */
const FIRST_COLUMN_INSET = "first:pl-3!";

/**
 * The bar of the row, 3px, in the color of the action: drawn on the first cell when the row is
 * hovered or has the focus inside, next to the pale blue the table already gives that row.
 */
const ROW_BAR =
  "relative before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-accent before:opacity-0 before:content-[''] group-hover:before:opacity-100 group-focus-within:before:opacity-100";

/**
 * The table of the list of lessons, with the columns of the Figma: Turma, Data, Horário, Conteúdo
 * (the title of the lesson, a link to its screen, for the keyboard and the screen reader), Responsável
 * (the confirmed teacher, or a dash that a screen reader reads as "Não informado"), Status (a tag)
 * and Ações. Clicking anywhere else on a row opens the lesson too; the links and the buttons of the
 * row do not (`DataTable` leaves them alone, and also a dialog opened from a cell).
 *
 * Ações exists only for who manages lessons (`lessons.manage`): the member sees neither the column
 * nor the icons, not even disabled. `LessonRowActions` draws them, and they stay disabled on a
 * cancelled lesson.
 */
export function LessonsTable({ lessons, caption }: LessonsTableProps): ReactElement {
  const { t, i18n } = useTranslation("lessons");
  const navigate = useNavigate();
  const canManage = useCan("lessons.manage");

  const columns: Column<LessonListItemResponseDto>[] = [
    {
      header: t("list.columns.class"),
      headerClassName: `uppercase ${FIRST_COLUMN_INSET}`,
      cellClassName: `${ROW_BAR} ${FIRST_COLUMN_INSET}`,
      render: (lesson) => lesson.class.name,
    },
    {
      header: t("list.columns.date"),
      headerClassName: "uppercase",
      cellClassName: "whitespace-nowrap",
      render: (lesson) => formatCalendarDate(lesson.date, i18n.language),
    },
    {
      header: t("list.columns.time"),
      headerClassName: "uppercase",
      cellClassName: "whitespace-nowrap",
      render: (lesson) =>
        t("classLessons.timeRange", { start: lesson.startTime, end: lesson.endTime }),
    },
    {
      header: t("list.columns.content"),
      headerClassName: "uppercase",
      cellClassName: "min-w-48",
      render: (lesson) => (
        <Link to={lessonDetailPath(lesson.id)} className={LINK_CLASSES}>
          {lesson.title}
        </Link>
      ),
    },
    {
      header: t("list.columns.teacher"),
      headerClassName: "uppercase",
      render: (lesson) =>
        lesson.teacher === null ? (
          <>
            <span aria-hidden="true">{t("details.empty", { ns: "common" })}</span>
            <span className="sr-only">{t("details.notInformed", { ns: "common" })}</span>
          </>
        ) : (
          lesson.teacher.name
        ),
    },
    {
      header: t("list.columns.status"),
      headerClassName: "uppercase",
      cellClassName: "whitespace-nowrap",
      render: (lesson) => (
        <Badge tone={lessonStatusTone(lesson.status)}>
          {t(LESSON_STATUS_LABEL_KEYS[lesson.status])}
        </Badge>
      ),
    },
  ];

  if (canManage) {
    columns.push({
      header: t("list.columns.actions"),
      headerClassName: "uppercase",
      render: (lesson) => <LessonRowActions lesson={lesson} />,
    });
  }

  return (
    <DataTable
      columns={columns}
      rows={lessons}
      rowKey={(lesson) => lesson.id}
      caption={caption}
      onRowClick={(lesson) => navigate(lessonDetailPath(lesson.id))}
    />
  );
}
