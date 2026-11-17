import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useAdjustHourEntry } from "@api/generated/hours/hours";
import type { MemberHourEntryResponseDto } from "@api/generated/model";
import { formatHours } from "@shared/lib/format";
import { Alert, Button, Dialog, TextArea, TextField } from "@shared/ui";

import { SUMMARY_SEPARATOR } from "../lib/bank-format";
import { invalidFields, STALE_QUEUE_ERRORS, toReviewError } from "../lib/review-errors";
import { invalidateAfterReview, invalidateIfStale } from "../lib/review-queries";
import {
  adjustEntryFormSchema,
  toAdjustBody,
  type AdjustEntryFormInput,
  type AdjustEntryFormValues,
  validNewMinutes,
} from "../schemas/adjust-entry.schema";
import { EntrySummary, loggedByText } from "./EntrySummary";

export interface AdjustEntryDialogProps {
  entry: MemberHourEntryResponseDto;
  onClose: () => void;
  /** The entry as the API answered it, over the row (which carries the member). */
  onAdjusted: (updated: MemberHourEntryResponseDto) => void;
  /** The entry is no longer pending (or is gone): the queue was read again. */
  onStale: () => void;
}

type AdjustSubmitError = "adjust.errors.generic" | "review.errors.selfReview";

/**
 * "Ajustar lançamento": the coordination accepts other minutes than the declared ones, with a
 * justification the member sees. The declared value stays recorded next to the adjustment, which the
 * notice says, with the new validated hours once the new value is valid. Mounted only while open.
 *
 * The queue is read again inside the mutation (the hook awaits it): "Salvar ajuste" stays busy and
 * the dialog open until the queue answers. A refusal of a field shows on the field, with the focus;
 * an entry that is no longer pending closes the dialog; anything else is an alert in the dialog,
 * which stays open.
 */
export function AdjustEntryDialog({
  entry,
  onClose,
  onAdjusted,
  onStale,
}: AdjustEntryDialogProps): ReactElement {
  const { t, i18n } = useTranslation("hours");
  const queryClient = useQueryClient();
  const formId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const [submitError, setSubmitError] = useState<AdjustSubmitError | null>(null);

  const { control, handleSubmit, setError, setFocus } = useForm<
    AdjustEntryFormInput,
    unknown,
    AdjustEntryFormValues
  >({
    resolver: zodResolver(adjustEntryFormSchema(entry.declaredMinutes)),
    defaultValues: { newValue: "", justification: "" },
  });
  const newValue = useWatch({ control, name: "newValue" });

  const adjust = useAdjustHourEntry({
    mutation: {
      onSuccess: () => invalidateAfterReview(queryClient, [entry]),
      onError: (error) => invalidateIfStale(queryClient, error, [entry]),
    },
  });
  const isPending = adjust.isPending;

  useEffect(() => {
    if (submitError !== null) errorRef.current?.focus();
  }, [submitError]);

  function handleError(error: unknown) {
    const kind = toReviewError(error);

    if (kind === "unchanged") {
      setError("newValue", { type: "server", message: "unchanged" });
      setFocus("newValue");
      return;
    }
    if (kind === "invalid") {
      // A refusal that points at no field of the form is the generic alert, below.
      const fields = invalidFields(error);
      const named: Array<keyof AdjustEntryFormInput> = [];
      if (fields.includes("validatedMinutes")) {
        setError("newValue", { type: "server", message: "newValueRange" });
        named.push("newValue");
      }
      if (fields.includes("justification")) {
        setError("justification", { type: "server", message: "justificationRequired" });
        named.push("justification");
      }
      if (named.length > 0) {
        setFocus(named[0]);
        return;
      }
    }
    if (STALE_QUEUE_ERRORS.has(kind)) {
      onStale();
      return;
    }
    setSubmitError(kind === "selfReview" ? "review.errors.selfReview" : "adjust.errors.generic");
  }

  function save(values: AdjustEntryFormValues) {
    if (adjust.isPending || inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitError(null);

    adjust.mutate(
      { id: entry.id, data: toAdjustBody(values) },
      {
        onSuccess: (updated) => onAdjusted({ ...entry, ...updated }),
        onError: handleError,
        onSettled: () => {
          inFlightRef.current = false;
        },
      },
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit(save)(event);
  }

  const declared = formatHours(entry.declaredMinutes);
  const validated = validNewMinutes(newValue, entry.declaredMinutes);

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("adjust.title")}
      closeLabel={t("adjust.close")}
      isDismissable={!isPending}
      footer={
        <>
          <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
            {t("adjust.back")}
          </Button>
          <Button variant="primary" type="submit" form={formId} isLoading={isPending}>
            {t("adjust.submit")}
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField isDisabled label={t("adjust.declared")} value={declared} onChange={() => {}} />
          <Controller
            name="newValue"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                isRequired
                label={t("adjust.newValue")}
                placeholder={t("adjust.newValuePlaceholder")}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                autoComplete="off"
                errorMessage={
                  fieldState.error?.message
                    ? t(`adjust.errors.${fieldState.error.message}`)
                    : undefined
                }
              />
            )}
          />
        </div>

        <Controller
          name="justification"
          control={control}
          render={({ field, fieldState }) => (
            <TextArea
              isRequired
              rows={2}
              label={t("adjust.justification")}
              description={t("adjust.justificationHelp")}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              errorMessage={
                fieldState.error?.message
                  ? t(`adjust.errors.${fieldState.error.message}`)
                  : undefined
              }
            />
          )}
        />

        <p className="rounded-[10px] bg-tedi-badge px-3.5 py-3 text-sm text-tedi-badge-foreground">
          {validated === null
            ? t("adjust.noticeDeclaredOnly", { declared })
            : t("adjust.notice", { declared, validated: formatHours(validated) })}
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
