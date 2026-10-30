import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useUnarchiveLessonPlan } from "@api/generated/catalog/catalog";
import type { LessonPlanResponseDto } from "@api/generated/model";
import { useCan } from "@modules/auth";
import pencilIcon from "@shared/assets/icons/pencil.svg";
import trashBinIcon from "@shared/assets/icons/trash-bin.svg";
import { Button, Chip, toast } from "@shared/ui";

import { invalidateLessonPlans } from "../lib/lesson-plan-queries";
import { ArchiveLessonPlanDialog } from "./ArchiveLessonPlanDialog";
import { LessonPlanFormDialog } from "./LessonPlanFormDialog";

export interface LessonPlanActionsProps {
  plan: Pick<LessonPlanResponseDto, "id" | "title" | "archivedAt">;
}

type OpenDialog = "edit" | "archive" | null;

export function LessonPlanActions({ plan }: LessonPlanActionsProps): ReactElement | null {
  const { t } = useTranslation("catalog");
  const queryClient = useQueryClient();
  const canManage = useCan("lessonPlans.manage");
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

  const unarchivePlan = useUnarchiveLessonPlan({
    mutation: {
      onSuccess: () => {
        toast.success(t("toast.unarchived"));
        void invalidateLessonPlans(queryClient);
      },
      onError: () => {
        toast.error(t("toast.unarchiveFailed"));
      },
    },
  });

  const isArchived = plan.archivedAt !== null;
  if (!isArchived && !canManage) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {isArchived ? <Chip>{t("archived")}</Chip> : null}
      {canManage ? (
        <>
          <Button
            variant="ghost"
            isIconOnly
            aria-label={t("actions.edit", { title: plan.title })}
            isDisabled={isArchived}
            onPress={() => setOpenDialog("edit")}
          >
            <img src={pencilIcon} alt="" aria-hidden="true" width={16} height={16} />
          </Button>
          {isArchived ? (
            <Button
              variant="ghost"
              aria-label={t("actions.unarchiveFor", { title: plan.title })}
              isLoading={unarchivePlan.isPending}
              onPress={() => unarchivePlan.mutate({ id: plan.id })}
            >
              {t("actions.unarchive")}
            </Button>
          ) : (
            <Button
              variant="ghost"
              isIconOnly
              aria-label={t("actions.archive", { title: plan.title })}
              onPress={() => setOpenDialog("archive")}
            >
              <img src={trashBinIcon} alt="" aria-hidden="true" width={16} height={16} />
            </Button>
          )}
        </>
      ) : null}
      {openDialog === "edit" ? (
        <LessonPlanFormDialog
          mode="edit"
          lessonPlanId={plan.id}
          onClose={() => setOpenDialog(null)}
        />
      ) : null}
      {openDialog === "archive" ? (
        <ArchiveLessonPlanDialog lessonPlanId={plan.id} onClose={() => setOpenDialog(null)} />
      ) : null}
    </div>
  );
}
