import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useUnarchiveCourse } from "@api/generated/catalog/catalog";
import type { CourseDetailDto } from "@api/generated/model";
import { Alert, Button, Dialog, toast } from "@shared/ui";

import { toSubmitError, type SubmitErrorKind } from "../lib/api-form-errors";
import { isCourseNotFound } from "../lib/course-detail";
import { invalidateAfterCourseArchiveChanged } from "../lib/course-queries";

export interface UnarchiveCourseDialogProps {
  course: Pick<CourseDetailDto, "id" | "name">;
  onClose: () => void;
}

/**
 * Reativar curso, with confirmation (GUS-139): the course takes new classes again. A plain
 * `Dialog` with Voltar / Reativar curso; the shared `ConfirmDialog` of GUS-88 can replace it when
 * that card is in.
 */
export function UnarchiveCourseDialog({
  course,
  onClose,
}: UnarchiveCourseDialogProps): ReactElement {
  const { t } = useTranslation("catalog");
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<SubmitErrorKind | null>(null);
  const unarchiveCourse = useUnarchiveCourse();
  const isPending = unarchiveCourse.isPending;

  function confirm() {
    if (isPending) return;
    setSubmitError(null);

    unarchiveCourse.mutate(
      { id: course.id },
      {
        onSuccess: (reactivated) => {
          toast.success(t("course.unarchive.success"));
          void invalidateAfterCourseArchiveChanged(queryClient, reactivated);
          onClose();
        },
        onError: (error) => {
          if (isCourseNotFound(error)) {
            setSubmitError("notFound");
            return;
          }
          const result = toSubmitError(error, () => null);
          setSubmitError(result.kind === "fields" ? "unknown" : result.kind);
        },
      },
    );
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("course.unarchive.title")}
      closeLabel={t("close")}
      isDismissable={!isPending}
      footer={
        <>
          <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
            {t("course.unarchive.back")}
          </Button>
          <Button variant="primary" isLoading={isPending} onPress={confirm}>
            {isPending ? t("course.unarchive.confirming") : t("course.unarchive.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-base">{t("course.unarchive.description")}</p>
        {submitError !== null ? (
          <Alert variant="error">{t(`course.actionErrors.${submitError}`)}</Alert>
        ) : null}
      </div>
    </Dialog>
  );
}
