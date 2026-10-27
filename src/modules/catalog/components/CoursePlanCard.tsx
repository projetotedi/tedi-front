import { useId, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import type {
  CourseLessonPlanItemResponseDto,
  CourseLessonPlansResponseDto,
} from "@api/generated/model";
import { useCan } from "@modules/auth";
import { DataTable, type Column } from "@shared/components/DataTable";
import { formatHours } from "@shared/lib/format";
import { Badge, Button, Card } from "@shared/ui";

export interface CoursePlanCardProps {
  sequence: CourseLessonPlansResponseDto;
  /** An archived course keeps its sequence as it is (RN-27): Editar sequência turns off. */
  isArchived: boolean;
  onEditSequence: () => void;
}

/**
 * Same link as the plan detail and its cards. The 44px height is the target of the touch (the row
 * of the table is as tall as the link, so the cell of a link has no padding of its own).
 */
const LINK_CLASSES =
  "-mx-1 inline-flex min-h-11 items-center rounded-sm px-1 font-medium text-sky-800 underline underline-offset-2 outline-hidden focus-visible:ring-3 focus-visible:ring-focus";

/**
 * "Plano do curso": the lesson plans of the course in order, with what the person needs to judge
 * the sequence (contents, duration, in how many courses each one is used, material), and the
 * planned workload as the API computed it (RF-018, RN-24). Editar sequência opens the dialog and
 * is there only for who can manage courses; for an archived course it stays, turned off, with the
 * reason on the page (a disabled button takes no focus, so a tooltip would never be read).
 */
export function CoursePlanCard({
  sequence,
  isArchived,
  onEditSequence,
}: CoursePlanCardProps): ReactElement {
  const { t } = useTranslation("catalog");
  const canManage = useCan("courses.manage");
  const archivedHintId = useId();

  const columns: Column<CourseLessonPlanItemResponseDto>[] = [
    {
      header: t("course.plan.columns.position"),
      headerClassName: "uppercase",
      cellClassName: "whitespace-nowrap",
      render: (item) => item.position,
    },
    {
      header: t("course.plan.columns.lessonPlan"),
      headerClassName: "uppercase",
      cellClassName: "py-0",
      render: (item) => (
        <span className="flex flex-wrap items-center gap-x-2">
          <Link to={`/lesson-plans/${item.lessonPlanId}`} className={LINK_CLASSES}>
            {item.title}
          </Link>
          {item.archivedAt !== null ? <Badge tone="neutral">{t("archived")}</Badge> : null}
        </span>
      ),
    },
    {
      header: t("course.plan.columns.contents"),
      headerClassName: "uppercase",
      render: (item) => item.contents.join("; "),
    },
    {
      header: t("course.plan.columns.duration"),
      headerClassName: "uppercase",
      cellClassName: "whitespace-nowrap",
      render: (item) => formatHours(item.expectedDurationMinutes),
    },
    {
      header: t("course.plan.columns.courseCount"),
      headerClassName: "uppercase",
      cellClassName: "whitespace-nowrap",
      render: (item) => t("courseCount", { count: item.courseCount }),
    },
    {
      header: t("course.plan.columns.material"),
      headerClassName: "uppercase",
      cellClassName: "py-0",
      render: (item) =>
        item.materialUrl ? (
          <a
            href={item.materialUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${t("openMaterial", { title: item.title })} ${t("detail.data.opensInNewTab")}`}
            className={LINK_CLASSES}
          >
            {t("openMaterialLabel")}
            <span aria-hidden="true" className="ms-1">
              ›
            </span>
          </a>
        ) : (
          <>
            <span aria-hidden="true">{t("detail.data.empty")}</span>
            <span className="sr-only">{t("course.plan.noMaterial")}</span>
          </>
        ),
    },
  ];

  const editAction = canManage ? (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        className="font-medium text-sky-800"
        isDisabled={isArchived}
        aria-describedby={isArchived ? archivedHintId : undefined}
        onPress={onEditSequence}
      >
        {t("course.plan.editSequence")}
        <span aria-hidden="true">›</span>
      </Button>
      {isArchived ? (
        <p id={archivedHintId} className="max-w-xs text-end text-sm text-muted">
          {t("course.plan.archivedHint")}
        </p>
      ) : null}
    </div>
  ) : null;

  return (
    <Card title={t("course.plan.title")} aside={editAction}>
      {sequence.items.length === 0 ? (
        <p className="text-base text-muted">{t("course.plan.empty")}</p>
      ) : (
        <DataTable
          columns={columns}
          rows={sequence.items}
          rowKey={(item) => item.lessonPlanId}
          caption={t("course.plan.title")}
        />
      )}
      <p className="mt-3 text-sm text-muted">
        {t("course.plan.note", { workload: formatHours(sequence.plannedWorkloadMinutes) })}
      </p>
    </Card>
  );
}
