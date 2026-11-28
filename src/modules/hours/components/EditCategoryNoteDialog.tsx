import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useSetNote } from "@api/generated/hours/hours";
import type { HourEntryCategory } from "@api/generated/model";
import { setNoteBodyNoteMax } from "@api/generated/zod/hours/hours";
import { Alert, Button, Dialog, TextArea, toast } from "@shared/ui";

import { CATEGORY_LABEL_KEYS } from "../lib/bank-labels";
import { toNoteError, type NoteErrorKind } from "../lib/note-errors";
import { invalidateAfterNoteChange } from "../lib/note-queries";
import { invalidFields } from "../lib/review-errors";
import {
  categoryNoteFormSchema,
  toSetNoteBody,
  type CategoryNoteFormInput,
  type CategoryNoteFormValues,
} from "../schemas/category-note.schema";

export interface EditCategoryNoteDialogProps {
  /** The member the observation is about (the person, not the one who writes it). */
  memberId: string;
  /** Her name, said under the title (the member sees the observation in "Meu perfil"). */
  memberName: string | undefined;
  category: HourEntryCategory;
  /** The observation as it is now: `null` when there is none, and then the dialog adds one. */
  note: string | null;
  /**
   * The dialog is done. `savedNote` is the observation the API kept when it was saved (`null`: it was
   * removed) and `undefined` when the dialog closed without saving, by Cancelar, Fechar, Escape or
   * because the text did not change. It lets the table tell where the focus goes next.
   */
  onClose: (savedNote?: string | null) => void;
}

/** The refusals shown as an alert: a refusal of the text itself goes on its field. */
type NoteSubmitError = Exclude<NoteErrorKind, "invalid">;

/**
 * The observation of the coordination on one category of a member (`PUT /members/:id/hours/notes`),
 * to add, edit or remove it. It works like Rejeitar: the hours of the member are read again inside
 * the mutation, so Salvar stays busy until the table has the new text; a refusal of the text shows on
 * its field, anything else is an alert and the dialog stays open. Blank text removes the observation
 * (`null` in the body), and text equal to the current one closes the dialog without sending anything,
 * so no audit event is written for nothing (GUS-191, D4). Mounted only while open.
 */
export function EditCategoryNoteDialog({
  memberId,
  memberName,
  category,
  note,
  onClose,
}: EditCategoryNoteDialogProps): ReactElement {
  const { t } = useTranslation("hours");
  const queryClient = useQueryClient();
  const formId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const [submitError, setSubmitError] = useState<NoteSubmitError | null>(null);

  const { control, handleSubmit, setError, setFocus } = useForm<
    CategoryNoteFormInput,
    unknown,
    CategoryNoteFormValues
  >({
    resolver: zodResolver(categoryNoteFormSchema),
    defaultValues: { note: note ?? "" },
  });

  const setNote = useSetNote({
    mutation: {
      onSuccess: (_saved, variables) => invalidateAfterNoteChange(queryClient, variables.id),
    },
  });
  const isPending = setNote.isPending;

  useEffect(() => {
    if (submitError !== null) errorRef.current?.focus();
  }, [submitError]);

  function handleError(error: unknown) {
    const kind = toNoteError(error);

    if (kind === "invalid" && invalidFields(error).includes("note")) {
      setError("note", { type: "server", message: "invalid" });
      setFocus("note");
      return;
    }
    setSubmitError(kind === "invalid" ? "generic" : kind);
  }

  function send(values: CategoryNoteFormValues) {
    if (setNote.isPending || inFlightRef.current) return;
    if (values.note === (note ?? "")) {
      onClose();
      return;
    }
    inFlightRef.current = true;
    setSubmitError(null);

    setNote.mutate(
      { id: memberId, data: toSetNoteBody(category, values) },
      {
        onSuccess: (saved) => {
          toast.success(t(saved.note === null ? "categoryNote.cleared" : "categoryNote.saved"));
          onClose(saved.note);
        },
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
      title={t("categoryNote.title", { category: t(CATEGORY_LABEL_KEYS[category]) })}
      description={
        memberName === undefined ? undefined : t("categoryNote.description", { name: memberName })
      }
      closeLabel={t("categoryNote.close")}
      isDismissable={!isPending}
      footer={
        <>
          <Button variant="secondary" isDisabled={isPending} onPress={() => onClose()}>
            {t("categoryNote.cancel")}
          </Button>
          <Button variant="primary" type="submit" form={formId} isLoading={isPending}>
            {t("categoryNote.submit")}
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
              rows={4}
              label={t("categoryNote.label")}
              description={t("categoryNote.help", { max: setNoteBodyNoteMax })}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              errorMessage={
                fieldState.error?.message
                  ? t(`categoryNote.errors.${fieldState.error.message}`, {
                      max: setNoteBodyNoteMax,
                    })
                  : undefined
              }
            />
          )}
        />

        {submitError !== null ? (
          <div ref={errorRef} tabIndex={-1} className="outline-none">
            <Alert variant="error">{t(`categoryNote.errors.${submitError}`)}</Alert>
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
