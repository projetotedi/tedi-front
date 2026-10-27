import { useId, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type {
  LessonPlanUsageCourseResponseDto,
  LessonPlanUsageResponseDto,
} from "@api/generated/model";
import { DataTable, type Column } from "@shared/components/DataTable";
import { formatHours } from "@shared/lib/format";
import { Alert, Button, Dialog } from "@shared/ui";

export interface ConfirmLessonPlanChangeDialogProps {
  /** Answer of `GET /lesson-plans/:id/usage` for the duration that is about to be saved. */
  usage: LessonPlanUsageResponseDto;
  isSaving: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

/**
 * RF-017: before a plan that courses use changes its duration, shows the workload of each course
 * before and after. Every number is the one the API sent; nothing is recalculated here.
 */
export function ConfirmLessonPlanChangeDialog({
  usage,
  isSaving,
  onConfirm,
  onBack,
}: ConfirmLessonPlanChangeDialogProps): ReactElement {
  const { t } = useTranslation("catalog");
  const coursesTitleId = useId();
  const whatChangesId = useId();

  const columns: Column<LessonPlanUsageCourseResponseDto>[] = [
    {
      header: t("confirmChange.columns.course"),
      headerClassName: "uppercase",
      render: (course) => (
        <>
          <span className="block font-medium">{course.courseName}</span>
          <span className="block text-sm text-muted">
            {t("confirmChange.position", {
              position: course.position,
              total: course.lessonPlanCount,
            })}
          </span>
        </>
      ),
    },
    {
      header: t("confirmChange.columns.currentWorkload"),
      headerClassName: "uppercase",
      cellClassName: "whitespace-nowrap",
      render: (course) => formatHours(course.currentWorkloadMinutes),
    },
    {
      header: t("confirmChange.columns.newWorkload"),
      headerClassName: "uppercase",
      cellClassName: "whitespace-nowrap font-semibold",
      render: (course) => formatHours(course.newWorkloadMinutes),
    },
  ];

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onBack();
      }}
      title={t("confirmChange.title")}
      closeLabel={t("close")}
      isDismissable={!isSaving}
      footer={
        <>
          <Button variant="secondary" isDisabled={isSaving} onPress={onBack}>
            {t("confirmChange.back")}
          </Button>
          <Button isLoading={isSaving} onPress={onConfirm}>
            {isSaving ? t("confirmChange.saving") : t("confirmChange.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Alert variant="warning" description={t("confirmChange.warningDescription")}>
          {t("confirmChange.warningTitle", { count: usage.courses.length })}
        </Alert>

        <section aria-labelledby={coursesTitleId} className="flex flex-col gap-2">
          <h3 id={coursesTitleId} className="text-base font-semibold">
            {t("confirmChange.coursesTitle")}
          </h3>
          <DataTable
            columns={columns}
            rows={usage.courses}
            rowKey={(course) => course.courseId}
            caption={t("confirmChange.coursesTitle")}
          />
        </section>

        <hr className="border-tedi-divider" />

        <section aria-labelledby={whatChangesId} className="flex flex-col gap-2">
          <h3 id={whatChangesId} className="text-base font-semibold">
            {t("confirmChange.whatChanges")}
          </h3>
          <p className="text-base">
            {t("confirmChange.durationChange", {
              current: formatHours(usage.currentDurationMinutes),
              next: formatHours(usage.newDurationMinutes),
            })}
          </p>
        </section>
      </div>
    </Dialog>
  );
}
