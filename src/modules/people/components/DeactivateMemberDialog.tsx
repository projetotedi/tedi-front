import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useMemo, useRef, useState, type ReactElement } from "react";
import { Controller, useForm, type FieldErrors } from "react-hook-form";
import { useTranslation } from "react-i18next";

import type { MemberListItemResponseDto } from "@api/generated/model";
import { useDeactivateMember } from "@api/generated/people/people";
import { ActionError } from "@modules/auth";
import { Alert, Button, DatePicker, Dialog, TextArea, TextField, toast } from "@shared/ui";

import { toDeactivateMemberError } from "../lib/member-errors";
import { invalidateAfterMemberChanged } from "../lib/member-queries";
import {
  createDeactivateMemberSchema,
  DEACTIVATE_MEMBER_FIELDS,
  emptyDeactivateMemberValues,
  MEMBER_LIMITS,
  toDeactivateMemberBody,
  type DeactivateMemberFieldName,
  type DeactivateMemberFormValues,
} from "../schemas/member.schema";
import { RequiredLabel } from "./RequiredLabel";

/** What the dialog needs of the member: both the row of the list and the record have it. */
export type DeactivateMemberTarget = Pick<MemberListItemResponseDto, "id" | "name" | "joinedAt">;

export interface DeactivateMemberDialogProps {
  member: DeactivateMemberTarget;
  onClose: () => void;
  /** Called once the API deactivated the member, before the dialog closes. */
  onDeactivated?: () => void;
}

/** What takes the focus inside a field: a text box, a segment of the date or a text area. */
const FOCUSABLE = "input:not(:disabled), textarea:not(:disabled), [role='spinbutton']";

/**
 * Inativar membro (GUS-149, GUS-194; Figma "Membro · modal Inativar membro" and "Membros · modal
 * Inativar membro"), opened by Inativar on the record and by the bin of the list, only for the
 * coordination (`members.deactivate`). The warning says what it does: the member leaves the project,
 * is no longer offered in Nova alocação and loses the access to the system; what was done stays.
 * It asks the exit date (today by default, never in the future nor before the member joined), the
 * reason, required, and an optional note. The reason shows on the list and the note is only kept,
 * and both say not to write health data (RNF-13).
 */
export function DeactivateMemberDialog({
  member,
  onClose,
  onDeactivated,
}: DeactivateMemberDialogProps): ReactElement {
  const { t } = useTranslation("people");
  const queryClient = useQueryClient();
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const inFlightRef = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const schema = useMemo(() => createDeactivateMemberSchema(member.joinedAt), [member.joinedAt]);
  const { control, handleSubmit, setError } = useForm<DeactivateMemberFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyDeactivateMemberValues(),
    // The date has no ref, so the focus on the first invalid field is set by hand.
    shouldFocusError: false,
  });

  const deactivateMember = useDeactivateMember();
  const isPending = deactivateMember.isPending;

  function focusField(name: DeactivateMemberFieldName) {
    formRef.current
      ?.querySelector(`[data-field="${name}"]`)
      ?.querySelector<HTMLElement>(FOCUSABLE)
      ?.focus();
  }

  function onInvalid(errors: FieldErrors<DeactivateMemberFormValues>) {
    const first = DEACTIVATE_MEMBER_FIELDS.find((name) => errors[name] !== undefined);
    if (first) focusField(first);
  }

  function handleError(error: unknown) {
    const result = toDeactivateMemberError(error);
    if (result.kind !== "fields") {
      setActionError(t(`member.deactivate.actionErrors.${result.kind}`));
      return;
    }
    for (const { name, message } of result.fields) setError(name, { type: "server", message });
    focusField(result.fields[0].name);
  }

  function deactivate(values: DeactivateMemberFormValues) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setActionError(null);

    deactivateMember.mutate(
      { id: member.id, data: toDeactivateMemberBody(values) },
      {
        onSuccess: () => {
          toast.success(t("member.deactivate.success", { name: member.name }));
          void invalidateAfterMemberChanged(queryClient, member.id);
          onDeactivated?.();
          onClose();
        },
        onError: handleError,
        onSettled: () => {
          inFlightRef.current = false;
        },
      },
    );
  }

  const errorText = (message: string | undefined) =>
    message ? t(`member.deactivate.errors.${message}`, MEMBER_LIMITS) : undefined;

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("member.deactivate.title")}
      closeLabel={t("member.deactivate.close")}
      isDismissable={!isPending}
      footer={
        <>
          <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
            {t("member.deactivate.back")}
          </Button>
          <Button variant="danger" type="submit" form={formId} isLoading={isPending}>
            {isPending ? t("member.deactivate.confirming") : t("member.deactivate.confirm")}
          </Button>
        </>
      }
    >
      <form
        ref={formRef}
        id={formId}
        noValidate
        aria-busy={isPending}
        onSubmit={(event) => void handleSubmit(deactivate, onInvalid)(event)}
        className="flex flex-col gap-4"
      >
        <Alert variant="warning" description={t("member.deactivate.warningDescription")}>
          {t("member.deactivate.warningTitle", { name: member.name })}
        </Alert>

        <div data-field="exitDate">
          <Controller
            name="exitDate"
            control={control}
            render={({ field, fieldState }) => (
              <DatePicker
                label={<RequiredLabel>{t("member.deactivate.exitDate")}</RequiredLabel>}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                isRequired
                errorMessage={errorText(fieldState.error?.message)}
              />
            )}
          />
        </div>

        <div data-field="reason">
          <Controller
            name="reason"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                label={<RequiredLabel>{t("member.deactivate.reason")}</RequiredLabel>}
                description={t("member.deactivate.reasonHelp")}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                autoComplete="off"
                isRequired
                autoFocus
                errorMessage={errorText(fieldState.error?.message)}
              />
            )}
          />
        </div>

        <div data-field="note">
          <Controller
            name="note"
            control={control}
            render={({ field, fieldState }) => (
              <TextArea
                label={t("member.deactivate.note")}
                description={t("member.deactivate.noteHelp")}
                rows={3}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                errorMessage={errorText(fieldState.error?.message)}
              />
            )}
          />
        </div>

        <ActionError message={actionError} />
      </form>
    </Dialog>
  );
}
