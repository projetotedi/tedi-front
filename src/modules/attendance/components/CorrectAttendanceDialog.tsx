import { zodResolver } from "@hookform/resolvers/zod";
import { useId, type FormEvent, type ReactElement } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import type { AttendanceCorrectionResponseDto, LessonResponseDto } from "@api/generated/model";
import { correctStudentAttendanceBodyReasonMax } from "@api/generated/zod/attendance/attendance";
import { Alert, Button, Dialog, RadioGroup, TextArea } from "@shared/ui";

import type { AttendanceErrorKind } from "../lib/attendance-errors";
import { formatLessonSummary, formatSignedAt } from "../lib/attendance-format";
import { RollCallStatus } from "../lib/roll-call";
import {
  correctStudentFormSchema,
  type CorrectStudentForm,
} from "../schemas/attendance-forms.schema";

const correctMemberFormSchema = correctStudentFormSchema.extend({ reason: z.string() });

export interface CorrectAttendanceDialogProps {
  kind: "student" | "member";
  lesson: LessonResponseDto;
  name: string;
  detail: string;
  status: RollCallStatus;
  signedBy: string | null;
  signedAt: string;
  corrections?: readonly AttendanceCorrectionResponseDto[];
  isSaving: boolean;
  error: AttendanceErrorKind | null;
  onSubmit: (values: CorrectStudentForm) => void;
  onClose: () => void;
}

/** Corrects a signed attendance; the reason is asked for students only, since the members API has none. */
export function CorrectAttendanceDialog({
  kind,
  lesson,
  name,
  detail,
  status,
  signedBy,
  signedAt,
  corrections = [],
  isSaving,
  error,
  onSubmit,
  onClose,
}: CorrectAttendanceDialogProps): ReactElement {
  const { t, i18n } = useTranslation("attendance");
  const formId = useId();
  const { control, handleSubmit } = useForm<CorrectStudentForm>({
    resolver: zodResolver(kind === "student" ? correctStudentFormSchema : correctMemberFormSchema),
    defaultValues: {
      status: status === RollCallStatus.present ? RollCallStatus.absent : RollCallStatus.present,
      reason: "",
    },
  });

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("correct.title")}
      closeLabel={t("dialog.close")}
      isDismissable={!isSaving}
      footer={
        <>
          <Button variant="secondary" isDisabled={isSaving} onPress={onClose}>
            {t("dialog.back")}
          </Button>
          <Button variant="primary" type="submit" form={formId} isLoading={isSaving}>
            {t("correct.submit")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event: FormEvent<HTMLFormElement>) =>
          void handleSubmit((values) => {
            if (!isSaving) onSubmit(values);
          })(event)
        }
      >
        <div className="rounded-[10px] bg-tedi-surface-subtle px-3.5 py-3">
          <p className="text-base font-semibold">{t("correct.person", { name, detail })}</p>
          <p className="text-base">
            {t("correct.launched", {
              status: t(`status.${status}`),
              name: signedBy ?? t("removedPerson"),
              time: formatSignedAt(signedAt, lesson.date, i18n.language),
            })}
          </p>
          <p className="text-sm text-muted">{formatLessonSummary(lesson, i18n.language)}</p>
        </div>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <RadioGroup
              isRequired
              orientation="horizontal"
              label={t("correct.newStatus")}
              value={field.value}
              onChange={field.onChange}
              name={field.name}
              inputRef={field.ref}
              options={Object.values(RollCallStatus).map((value) => ({
                value,
                label: t(`status.${value}`),
                isDisabled: value === status,
              }))}
            />
          )}
        />
        {kind === "student" ? (
          <Controller
            name="reason"
            control={control}
            render={({ field, fieldState }) => (
              <TextArea
                isRequired
                rows={3}
                label={t("correct.reason")}
                description={t("correct.reasonHelp")}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                errorMessage={
                  fieldState.error?.message
                    ? t(`validation.${fieldState.error.message}`, {
                        max: correctStudentAttendanceBodyReasonMax,
                      })
                    : undefined
                }
              />
            )}
          />
        ) : null}
        <p className="rounded-[10px] bg-tedi-warning px-3.5 py-3 text-sm text-tedi-status-warning-foreground">
          {t(`correct.notice.${kind}`)}
        </p>
        {corrections.length > 0 ? (
          <section aria-label={t("correct.history")}>
            <h3 className="text-base font-semibold">{t("correct.history")}</h3>
            <ul className="flex flex-col gap-2 pt-2">
              {corrections.map((correction) => (
                <li key={correction.id} className="text-sm">
                  {t("correct.historyItem", {
                    from: t(`status.${correction.fromStatus}`),
                    to: t(`status.${correction.toStatus}`),
                    name: correction.correctedBy?.name ?? t("removedPerson"),
                    time: formatSignedAt(correction.correctedAt, lesson.date, i18n.language),
                  })}
                  {correction.reason ? (
                    <span className="block text-muted">{correction.reason}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {error === null ? null : <Alert variant="error">{t(`errors.${error}`)}</Alert>}
      </form>
    </Dialog>
  );
}
