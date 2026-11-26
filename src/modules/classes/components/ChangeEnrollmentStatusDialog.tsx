import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useUpdateEnrollmentStatus } from "@api/generated/classes/classes";
import { EnrollmentStatus } from "@api/generated/model";
import { Alert, Button, DatePicker, Dialog, RadioGroup, TextArea, toast } from "@shared/ui";

import { seatsLeftOf, toEnrollmentError, type EnrollmentErrorKind } from "../lib/enrollment-errors";
import { invalidateAfterEnrollmentChanged } from "../lib/enrollment-queries";
import { formatInstantDate, todayCalendarDate } from "../lib/format";
import {
  ENROLLMENT_STATUS_LIMITS,
  enrollmentStatusFormSchema,
  toEnrollmentStatusBody,
  type EnrollmentStatusFormValues,
} from "../schemas/enrollment-status.schema";

/** The enrollment the dialog changes, as the screen that opens it knows it. */
export interface EnrollmentToChange {
  id: string;
  studentName: string;
  status: EnrollmentStatus;
  enrolledAt: string;
}

export interface ChangeEnrollmentStatusDialogProps {
  enrollment: EnrollmentToChange;
  /** "Informática Básica — Turma A · INFO-A · 2026.1", the line under the student. */
  classLabel: string;
  onClose: () => void;
}

const STATUS_ORDER = [
  EnrollmentStatus.active,
  EnrollmentStatus.dropped,
  EnrollmentStatus.completed,
] as const;

const DATE_ERRORS: ReadonlySet<EnrollmentErrorKind> = new Set([
  "effectiveDateInFuture",
  "effectiveDateBeforeEnrollment",
]);

/**
 * Alterar situação da matrícula (GUS-138, Figma): who the enrollment is of and how it is now, the
 * new status (Ativa, Desistente or Concluída), the day it holds from (today by default) and an
 * optional reason. Desistente frees the seat. A day the API refuses goes on the date field; any
 * other refusal (the class is full, closed or archived when going back to Ativa) is an alert above
 * the buttons, and the dialog stays open.
 */
export function ChangeEnrollmentStatusDialog({
  enrollment,
  classLabel,
  onClose,
}: ChangeEnrollmentStatusDialogProps): ReactElement {
  const { t, i18n } = useTranslation("classes");
  const queryClient = useQueryClient();
  const formId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const [submitError, setSubmitError] = useState<{
    kind: EnrollmentErrorKind;
    seats: number | null;
  } | null>(null);

  const { control, handleSubmit, setError, setFocus } = useForm<EnrollmentStatusFormValues>({
    resolver: zodResolver(enrollmentStatusFormSchema),
    defaultValues: { status: "", effectiveDate: todayCalendarDate(), reason: "" },
  });

  const updateStatus = useUpdateEnrollmentStatus();
  const isPending = updateStatus.isPending;

  useEffect(() => {
    if (submitError !== null) errorRef.current?.focus();
  }, [submitError]);

  function save(values: EnrollmentStatusFormValues) {
    if (isPending || inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitError(null);

    updateStatus.mutate(
      { id: enrollment.id, data: toEnrollmentStatusBody(values) },
      {
        onSuccess: () => {
          toast.success(t("enrollment.statusDialog.success", { name: enrollment.studentName }));
          void invalidateAfterEnrollmentChanged(queryClient);
          onClose();
        },
        onError: (error) => {
          const kind = toEnrollmentError(error);
          if (DATE_ERRORS.has(kind)) {
            setError("effectiveDate", { type: "server", message: kind });
            setFocus("effectiveDate");
            return;
          }
          setSubmitError({ kind, seats: seatsLeftOf(error) });
        },
        onSettled: () => {
          inFlightRef.current = false;
        },
      },
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit(save)(event);
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("enrollment.statusDialog.title")}
      closeLabel={t("close")}
      isDismissable={!isPending}
      footer={
        <>
          <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
            {t("enrollment.statusDialog.back")}
          </Button>
          <Button variant="primary" type="submit" form={formId} isLoading={isPending}>
            {t("enrollment.statusDialog.save")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        aria-busy={isPending}
        onSubmit={onSubmit}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1 rounded-[10px] bg-tedi-surface-subtle p-3">
          <p className="font-semibold">
            {t("enrollment.statusDialog.student", { name: enrollment.studentName })}
          </p>
          <p>{classLabel}</p>
          <p className="text-sm text-muted">
            {t("enrollment.statusDialog.current", {
              status: t(`enrollment.status.${enrollment.status}`),
              date: formatInstantDate(enrollment.enrolledAt, i18n.language),
            })}
          </p>
        </div>

        <Controller
          name="status"
          control={control}
          render={({ field, fieldState }) => (
            <RadioGroup
              label={t("enrollment.statusDialog.newStatus")}
              isRequired
              orientation="horizontal"
              value={field.value || null}
              onChange={field.onChange}
              name={field.name}
              inputRef={field.ref}
              options={STATUS_ORDER.map((status) => ({
                value: status,
                label: t(`enrollment.status.${status}`),
                description: t(`enrollment.statusDialog.hints.${status}`),
              }))}
              errorMessage={
                fieldState.error ? t("enrollment.statusDialog.errors.required") : undefined
              }
            />
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Controller
            name="effectiveDate"
            control={control}
            render={({ field, fieldState }) => (
              <DatePicker
                label={t("enrollment.statusDialog.effectiveDate")}
                isRequired
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                errorMessage={
                  fieldState.error?.message
                    ? t(`enrollment.statusDialog.errors.${fieldState.error.message}`)
                    : undefined
                }
              />
            )}
          />
          <Controller
            name="reason"
            control={control}
            render={({ field, fieldState }) => (
              <TextArea
                label={t("enrollment.statusDialog.reason")}
                placeholder={t("enrollment.statusDialog.reasonExample")}
                rows={2}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                errorMessage={
                  fieldState.error?.message
                    ? t(
                        `enrollment.statusDialog.errors.${fieldState.error.message}`,
                        ENROLLMENT_STATUS_LIMITS,
                      )
                    : undefined
                }
              />
            )}
          />
        </div>

        <Alert variant="info">{t("enrollment.statusDialog.notice")}</Alert>

        {submitError !== null ? (
          <div ref={errorRef} tabIndex={-1} className="outline-none">
            <Alert variant="error">
              {t(`enrollment.errors.${submitError.kind}`, { count: submitError.seats ?? 0 })}
            </Alert>
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
