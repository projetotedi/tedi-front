import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import {
  getGetMemberHoursQueryKey,
  getGetMyHoursSummaryQueryKey,
  useSetNote,
} from "@api/generated/hours/hours";
import type { HoursCategoryTotalDto } from "@api/generated/model";
import { setNoteBodyNoteMax } from "@api/generated/zod/hours/hours";
import { Alert, Button, Dialog, TextArea, toast } from "@shared/ui";

import { CATEGORY_LABEL_KEYS } from "../lib/bank-labels";
import { invalidFields, toReviewError } from "../lib/review-errors";
import {
  categoryNoteFormSchema,
  toNoteBody,
  type CategoryNoteFormInput,
  type CategoryNoteFormValues,
} from "../schemas/category-note.schema";

export interface CategoryNoteDialogProps {
  personId: string;
  total: HoursCategoryTotalDto;
  onClose: () => void;
}

export function CategoryNoteDialog({
  personId,
  total,
  onClose,
}: CategoryNoteDialogProps): ReactElement {
  const { t } = useTranslation("hours");
  const queryClient = useQueryClient();
  const formId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const [hasFailed, setHasFailed] = useState(false);

  const { control, handleSubmit, setError, setFocus } = useForm<
    CategoryNoteFormInput,
    unknown,
    CategoryNoteFormValues
  >({
    resolver: zodResolver(categoryNoteFormSchema),
    defaultValues: { note: total.note ?? "" },
  });

  const save = useSetNote({
    mutation: {
      onSuccess: () =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetMemberHoursQueryKey(personId) }),
          queryClient.invalidateQueries({ queryKey: getGetMyHoursSummaryQueryKey() }),
        ]),
    },
  });
  const isPending = save.isPending;

  useEffect(() => {
    if (hasFailed) errorRef.current?.focus();
  }, [hasFailed]);

  function send(values: CategoryNoteFormValues) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setHasFailed(false);

    save.mutate(
      { id: personId, data: toNoteBody(total.category, values) },
      {
        onSuccess: (saved) => {
          toast.success(t(saved.note === null ? "note.cleared" : "note.saved"));
          onClose();
        },
        onError: (error) => {
          if (toReviewError(error) === "invalid" && invalidFields(error).includes("note")) {
            setError("note", { type: "server", message: "tooLong" });
            setFocus("note");
            return;
          }
          setHasFailed(true);
        },
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
      title={t("note.title", { category: t(CATEGORY_LABEL_KEYS[total.category]) })}
      closeLabel={t("note.close")}
      isDismissable={!isPending}
      footer={
        <>
          <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
            {t("note.back")}
          </Button>
          <Button variant="primary" type="submit" form={formId} isLoading={isPending}>
            {t("note.submit")}
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
        <Controller
          name="note"
          control={control}
          render={({ field, fieldState }) => (
            <TextArea
              rows={3}
              label={t("note.label")}
              description={t("note.help")}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              errorMessage={
                fieldState.error?.message
                  ? t(`note.errors.${fieldState.error.message}`, { max: setNoteBodyNoteMax })
                  : undefined
              }
            />
          )}
        />

        {hasFailed ? (
          <div ref={errorRef} tabIndex={-1} className="outline-none">
            <Alert variant="error">{t("note.errors.generic")}</Alert>
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
