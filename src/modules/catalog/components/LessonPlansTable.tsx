import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { LessonPlanListStatus, type LessonPlanListItemDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import { DataTable, type Column } from "@shared/components/DataTable";
import { formatHours } from "@shared/lib/format";
import { Badge, Button } from "@shared/ui";
import pencilIcon from "@shared/assets/icons/pencil.svg";
import trashBinIcon from "@shared/assets/icons/trash-bin.svg";

const STATUS_LABEL_KEYS: Record<LessonPlanListStatus, string> = {
  [LessonPlanListStatus.in_use]: "inUse",
  [LessonPlanListStatus.unused]: "unused",
  [LessonPlanListStatus.archived]: "archived",
};

export interface LessonPlansTableProps {
  plans: LessonPlanListItemDto[];
  caption: string;
  onEdit: (plan: LessonPlanListItemDto) => void;
  onArchive: (plan: LessonPlanListItemDto) => void;
  onUnarchive: (plan: LessonPlanListItemDto) => void;
  /** The plan whose Reativar is on its way, to show it loading. */
  unarchivingId?: string | null;
}

/**
 * The table of the list of lesson plans, with the columns of the Figma: Plano de aula (a link to the
 * detail, for the keyboard and the screen reader), Conteúdos, Duração, Cursos que usam, Turmas que
 * já usaram ("—": the lessons are another module's, see GUS-95), Material ("Abrir ›"), Situação and
 * Ações. Clicking anywhere else on a row opens the detail too; the buttons and links of the row do
 * not (`DataTable` leaves them alone). The actions are only for who manages lesson plans: the
 * pencil and the bin on a plan in use or unused, Reativar on an archived one.
 */
export function LessonPlansTable({
  plans,
  caption,
  onEdit,
  onArchive,
  onUnarchive,
  unarchivingId = null,
}: LessonPlansTableProps): ReactElement {
  const { t } = useTranslation("catalog");
  const navigate = useNavigate();
  const canManage = useCan("lessonPlans.manage");

  const columns: Column<LessonPlanListItemDto>[] = [
    {
      header: t("lessonPlan").toLocaleUpperCase(),
      headerClassName: "w-[22%]",
      cellClassName:
        "relative w-[22%] pl-0 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-accent before:opacity-0 before:content-[''] group-hover:before:opacity-100",
      render: (plan) => (
        <Link
          to={`/lesson-plans/${plan.id}`}
          className="font-medium text-foreground hover:underline focus-visible:underline"
          title={plan.title}
        >
          {plan.title}
        </Link>
      ),
    },
    {
      header: t("contents").toLocaleUpperCase(),
      headerClassName: "w-[18%]",
      cellClassName: "w-[18%]",
      render: (plan) => <span>{plan.contents.join(", ")}</span>,
    },
    {
      header: t("duration").toLocaleUpperCase(),
      headerClassName: "w-[9%]",
      cellClassName: "w-[9%] whitespace-nowrap",
      render: (plan) => <span>{formatHours(plan.expectedDurationMinutes)}</span>,
    },
    {
      header: t("coursesUsing").toLocaleUpperCase(),
      headerClassName: "w-[10%]",
      cellClassName: "w-[10%] whitespace-nowrap",
      render: (plan) =>
        plan.courseCount > 0 ? t("courseCount", { count: plan.courseCount }) : "—",
    },
    {
      header: t("classesUsed").toLocaleUpperCase(),
      headerClassName: "w-[12%]",
      cellClassName: "w-[12%]",
      render: () => <span aria-label={t("classesCountUnavailable")}>—</span>,
    },
    {
      header: t("material").toLocaleUpperCase(),
      headerClassName: "w-[8%]",
      cellClassName: "w-[8%] whitespace-nowrap",
      render: (plan) =>
        plan.materialUrl ? (
          <a
            href={plan.materialUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sky-800 underline-offset-2 hover:underline focus-visible:underline"
            aria-label={t("openMaterial", { title: plan.title })}
          >
            {t("openMaterialLabel")}
          </a>
        ) : (
          "—"
        ),
    },
    {
      header: t("status").toLocaleUpperCase(),
      headerClassName: "w-[11%]",
      cellClassName: "w-[11%]",
      render: (plan) => (
        <Badge tone={plan.status === LessonPlanListStatus.in_use ? "success" : "neutral"}>
          {t(STATUS_LABEL_KEYS[plan.status])}
        </Badge>
      ),
    },
  ];

  if (canManage) {
    columns.push({
      header: t("actionsHeader").toLocaleUpperCase(),
      headerClassName: "w-[10%]",
      cellClassName: "w-[10%]",
      render: (plan) =>
        plan.archivedAt ? (
          <Button
            variant="ghost"
            aria-label={t("actions.unarchiveFor", { title: plan.title })}
            isLoading={unarchivingId === plan.id}
            onPress={() => onUnarchive(plan)}
          >
            {t("actions.unarchive")}
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <span title={t("edit", { title: plan.title })}>
              <Button
                variant="ghost"
                isIconOnly
                aria-label={t("edit", { title: plan.title })}
                onPress={() => onEdit(plan)}
              >
                <img src={pencilIcon} alt="" aria-hidden="true" width={16} height={16} />
              </Button>
            </span>
            <span title={t("archiveAction", { title: plan.title })}>
              <Button
                variant="ghost"
                isIconOnly
                aria-label={t("archiveAction", { title: plan.title })}
                className="text-danger"
                onPress={() => onArchive(plan)}
              >
                <img src={trashBinIcon} alt="" aria-hidden="true" width={16} height={16} />
              </Button>
            </span>
          </div>
        ),
    });
  }

  return (
    <DataTable
      columns={columns}
      rows={plans}
      rowKey={(plan) => plan.id}
      caption={caption}
      onRowClick={(plan) => navigate(`/lesson-plans/${plan.id}`)}
    />
  );
}
