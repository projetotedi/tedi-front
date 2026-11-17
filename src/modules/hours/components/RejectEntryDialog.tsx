import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useRejectHourEntry } from "@api/generated/hours/hours";
import type { MemberHourEntryResponseDto } from "@api/generated/model";
import { formatHours } from "@shared/lib/format";
import { Alert, Button, Dialog, TextArea } from "@shared/ui";

import { SUMMARY_SEPARATOR } from "../lib/bank-format";
import { invalidFields, STALE_QUEUE_ERRORS, toReviewError } from "../lib/review-errors";
import { invalidateAfterReview, invalidateIfStale } from "../lib/review-queries";
import {
  rejectEntryFormSchema,
  toRejectBody,
  type RejectEntryFormInput,
  type RejectEntryFormValues,
} from "../schemas/reject-entry.schema";
import { EntrySummary, loggedByText } from "./EntrySummary";

export interface RejectEntryDialogProps {
  entry: MemberHourEntryResponseDto;
  onClose: () => void;
  onRejected: (entry: MemberHourEntryResponseDto) => void;
  /** The entry is no longer pending (or is gone): the queue was read again. */
  onStale: () => void;
}

type RejectSubmitError = "reject.errors.generic" | "review.errors.selfReview";

/**
 * "Rejeitar lançamento": the hours do not enter the bank and the entry stays in the history as
 * Rejeitado, with a reason the member sees. It works like Ajustar: the queue is read again inside
 * the mutation, a refusal of the reason shows on its field, an entry that is no longer pending
 * closes the dialog, anything else is an alert and the dialog stays open. Mounted only while open.
 */
export function RejectEntryDialog({
  entry,
  onClose,
  onRejected,
  onStale,
}: RejectEntryDialogProps): ReactElement {
  const { t, i18n } = useTranslation("hours");
  const queryClient = useQueryClient();
  const formId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const [submitError, setSubmitError] = useState<RejectSubmitError | null>(null);

  const { control, handleSubmit, setError, setFocus } = useForm<
    RejectEntryFormInput,
    unknown,
    RejectEntryFormValues
  >({
    resolver: zodResolver(rejectEntryFormSchema),
    defaultValues: { reason: "" },
  });

  const reject = useRejectHourEntry({
    mutation: {
      onSuccess: () => invalidateAfterReview(queryClient, [entry]),
      onError: (error) => invalidateIfStale(queryClient, error, [entry]),
    },
  });
  const isPending = reject.isPending;

  useEffect(() => {
    if (submitError !== null) errorRef.current?.focus();
  }, [submitError]);

  function handleError(error: unknown) {
    const kind = toReviewError(error);

    if (kind === "invalid" && invalidFields(error).includes("reason")) {
      setError("reason", { type: "server", message: "reasonRequired" });
      setFocus("reason");
      return;
    }
    if (STALE_QUEUE_ERRORS.has(kind)) {
      onStale();
      return;
    }
    setSubmitError(kind === "selfReview" ? "review.errors.selfReview" : "reject.errors.generic");
  }

  function send(values: RejectEntryFormValues) {
    if (reject.isPending || inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitError(null);

    reject.mutate(
      { id: entry.id, data: toRejectBody(values) },
      {
        onSuccess: () => onRejected(entry),
        onError: handleError,
        onSettled: () => {
          inFlightRef.current = false;
        },
      },
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit(send)(event);
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("reject.title")}
      closeLabel={t("reject.close")}
      isDismissable={!isPending}
      footer={
        <>
          <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
            {t("reject.back")}
          </Button>
          <Button variant="danger" type="submit" form={formId} isLoading={isPending}>
            {t("reject.submit")}
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
        <EntrySummary
          entry={entry}
          detail={[
            loggedByText(entry, t, i18n.language),
            t("review.entrySummary.pendingSuffix"),
          ].join(SUMMARY_SEPARATOR)}
        />

        <Controller
          name="reason"
          control={control}
          render={({ field, fieldState }) => (
            <TextArea
              isRequired
              rows={2}
              label={t("reject.reason")}
              description={t("reject.reasonHelp")}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              errorMessage={
                fieldState.error?.message
                  ? t(`reject.errors.${fieldState.error.message}`)
                  : undefined
              }
            />
          )}
        />

        <p className="rounded-[10px] bg-tedi-warning px-3.5 py-3 text-sm text-tedi-status-warning-foreground">
          {t("reject.notice", { hours: formatHours(entry.declaredMinutes) })}
        </p>

        {submitError !== null ? (
          <div ref={errorRef} tabIndex={-1} className="outline-none">
            <Alert variant="error">{t(submitError)}</Alert>
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
