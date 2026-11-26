import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState, type FormEvent, type ReactElement } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useJustifyAbsence } from "@api/generated/attendance/attendance";
import {
  AbsenceJustificationReason,
  type LessonResponseDto,
  type StudentAttendanceResponseDto,
} from "@api/generated/model";
import { justifyAbsenceBodyNoteMax } from "@api/generated/zod/attendance/attendance";
import { Alert, Button, Dialog, TextArea, toast } from "@shared/ui";

import { toAttendanceError, type AttendanceErrorKind } from "../lib/attendance-errors";
import { formatLessonSummary, formatSignedAt } from "../lib/attendance-format";
import { invalidateStudentAttendance } from "../lib/attendance-queries";
import {
  justifyAbsenceFormSchema,
  type JustifyAbsenceForm,
} from "../schemas/attendance-forms.schema";

export interface JustifyAbsenceDialogProps {
  lesson: LessonResponseDto;
  studentName: string;
  attendance: StudentAttendanceResponseDto;
  onClose: () => void;
}

/** Justifies an absence with a free-text reason, sent as the note because the API reason is a closed list. */
export function JustifyAbsenceDialog({
  lesson,
  studentName,
  attendance,
  onClose,
}: JustifyAbsenceDialogProps): ReactElement {
  const { t, i18n } = useTranslation("attendance");
  const queryClient = useQueryClient();
  const formId = useId();
  const [submitError, setSubmitError] = useState<AttendanceErrorKind | null>(null);
  const current = attendance.justification;
  const { control, handleSubmit } = useForm<JustifyAbsenceForm>({
    resolver: zodResolver(justifyAbsenceFormSchema),
    defaultValues: {
      reason:
        current?.note ??
        (current?.reason === AbsenceJustificationReason.health ? t("justify.health") : ""),
    },
  });
  const justify = useJustifyAbsence({
    mutation: {
      onSettled: () => void invalidateStudentAttendance(queryClient, lesson),
    },
  });

  function send({ reason }: JustifyAbsenceForm) {
    if (justify.isPending) return;
    setSubmitError(null);
    justify.mutate(
      {
        id: attendance.id,
        data: { reason: current?.reason ?? AbsenceJustificationReason.other, note: reason },
      },
      {
        onSuccess: () => {
          toast.success(t("justify.success"));
          onClose();
        },
        onError: (error) => setSubmitError(toAttendanceError(error)),
      },
    );
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("justify.title")}
      closeLabel={t("dialog.close")}
      isDismissable={!justify.isPending}
      footer={
        <>
          <Button variant="secondary" isDisabled={justify.isPending} onPress={onClose}>
            {t("dialog.back")}
          </Button>
          <Button variant="primary" type="submit" form={formId} isLoading={justify.isPending}>
            {t("justify.submit")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event: FormEvent<HTMLFormElement>) => void handleSubmit(send)(event)}
      >
        <div className="rounded-[10px] bg-tedi-surface-subtle px-3.5 py-3">
          <p className="text-base font-semibold">{t("justify.student", { name: studentName })}</p>
          <p className="text-base">{formatLessonSummary(lesson, i18n.language)}</p>
          <p className="text-sm text-muted">
            {t("justify.signedBy", {
              name: attendance.signedBy?.name ?? t("removedPerson"),
              time: formatSignedAt(attendance.signedAt, lesson.date, i18n.language),
            })}
          </p>
        </div>
        <Controller
          name="reason"
          control={control}
          render={({ field, fieldState }) => (
            <TextArea
              isRequired
              rows={3}
              label={t("justify.reason")}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              errorMessage={
                fieldState.error?.message
                  ? t(`validation.${fieldState.error.message}`, { max: justifyAbsenceBodyNoteMax })
                  : undefined
              }
            />
          )}
        />
        <p className="rounded-[10px] bg-tedi-badge px-3.5 py-3 text-sm text-tedi-badge-foreground">
          {t("justify.notice")}
        </p>
        {submitError === null ? null : <Alert variant="error">{t(`errors.${submitError}`)}</Alert>}
      </form>
    </Dialog>
  );
}
