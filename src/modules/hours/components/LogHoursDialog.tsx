import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type RefObject,
} from "react";
import { Controller, useForm, type FieldErrors } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useLogHoursForMember, useLogMyHours } from "@api/generated/hours/hours";
import type { HourEntryResponseDto } from "@api/generated/model";
import { useAuth, useCan } from "@modules/auth";
import { formatHours } from "@shared/lib/format";
import { Alert, Button, Dialog, Select, TextField, toast, type SelectOption } from "@shared/ui";

import { formatDayMonth, todayIsoDate } from "../lib/entry-format";
import {
  LOG_HOURS_FIELDS,
  logHoursIssueDisplay,
  toLogHoursError,
  type LogHoursFieldName,
  type LogHoursIssue,
} from "../lib/entry-errors";
import {
  ENTRY_CATEGORY_LABEL_KEYS,
  LOGGABLE_CATEGORIES,
  toLoggableCategory,
} from "../lib/entry-labels";
import {
  invalidateAfterLoggedForMember,
  invalidateAfterOwnEntryChange,
} from "../lib/entry-queries";
import {
  emptyLogHoursFormInput,
  logHoursFormSchema,
  toCreateHourEntryBody,
  type LogHoursFormInput,
  type LogHoursFormValues,
} from "../schemas/hour-entry.schema";

/** The member whose hours are logged, as the screen that opens the dialog knows her. */
export interface LogHoursMember {
  id: string;
  /** Shown whole in the title and in the notice. */
  name: string;
}

export interface LogHoursDialogProps {
  /** Logs on behalf of this member. Without it, the person logs her own hours. */
  member?: LogHoursMember;
  onClose: () => void;
  /** Called with the entry the API created, before `onClose`. */
  onLogged?: (entry: HourEntryResponseDto) => void;
}

/** The form, with today read on the calendar of the machine each time it is checked. */
const LOG_HOURS_SCHEMA = logHoursFormSchema(() => todayIsoDate());

/** A select has no ref to its field, so the focus goes to the button that opens it. */
function focusSelect(wrapper: RefObject<HTMLDivElement | null>): void {
  wrapper.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
}

/**
 * "Lançar horas" (F7, RF-063): Atividade, Categoria, Data, Horas and Observações, with Cancelar and
 * Lançar horas. The entry goes in as pending, for the coordination to validate.
 *
 * - **Own hours** (no `member`): `POST /me/hour-entries`. On success the summary and the entries of
 *   the person are read again, so "Meu perfil" changes with no reload (CA1).
 * - **On behalf of a member** (`member`): the title says her name, and a notice under it says who
 *   logged it is recorded and that it goes in as pending; the dialog is described by that notice, so
 *   it is read when it opens (CA3). `POST /members/:id/hour-entries`; on success the hours of that
 *   member are read again. Only who may log for others (`hours.logForOthers`: the director for her
 *   department, the coordination for anyone) gets the form: without the permission the dialog draws
 *   nothing. Whether the member is in the department of the director is for the API to say, and its
 *   refusals have their own messages. `LogHoursForMemberButton` is the button that opens it.
 * - **The fields.** Data starts with today and refuses a day after it; Horas is typed as "2h30" and
 *   sent as minutes; Categoria never offers Aula (the hours of a lesson come from the attendance).
 *   An invalid field shows its message under it, the first one takes the focus and nothing is sent.
 * - **The refusals of the API.** 400 `VALIDATION_FAILED` and `HOUR_ENTRY_DATE_IN_FUTURE` go to their
 *   fields. Logging for oneself on behalf (warning), a member out of reach or gone (error) turn
 *   Lançar horas off; the network and anything else are an alert that a new attempt clears. The
 *   alert takes the focus.
 * - **While it is on its way** the dialog cannot be closed (X, Esc and Cancelar are off) and a second
 *   press is ignored.
 *
 * Mount it only while it is open, so each opening starts clean.
 */
export function LogHoursDialog({
  member,
  onClose,
  onLogged,
}: LogHoursDialogProps): ReactElement | null {
  const { t, i18n } = useTranslation("hours");
  const canLogForOthers = useCan("hours.logForOthers");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const formId = useId();
  const noticeId = useId();
  const issueId = useId();
  const issueRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const [issue, setIssue] = useState<LogHoursIssue | null>(null);

  const { control, handleSubmit, setError, setFocus } = useForm<
    LogHoursFormInput,
    unknown,
    LogHoursFormValues
  >({
    resolver: zodResolver(LOG_HOURS_SCHEMA),
    defaultValues: emptyLogHoursFormInput(todayIsoDate()),
    // The select has no ref, so the focus on the first invalid field is set by hand.
    shouldFocusError: false,
  });

  // Both hooks are always called; the cache is told even if the dialog is gone by the time the
  // answer arrives, without holding the dialog for it.
  const logMine = useLogMyHours({
    mutation: {
      onSuccess: () =>
        void invalidateAfterOwnEntryChange(queryClient, user === null ? null : user.id),
    },
  });
  const logForMember = useLogHoursForMember({
    mutation: {
      onSuccess: (_entry, { id }) => void invalidateAfterLoggedForMember(queryClient, id),
    },
  });
  const isPending = logMine.isPending || logForMember.isPending;
  const display = issue === null ? null : logHoursIssueDisplay(issue);
  const isBlocked = display?.blocks === true;
  // A 403 for one's own hours is not about "this person": it has a message of its own.
  const issueKey = issue === "forbidden" && member === undefined ? "forbiddenOwn" : issue;

  useEffect(() => {
    if (issue !== null) issueRef.current?.focus();
  }, [issue]);

  function focusField(name: LogHoursFieldName) {
    if (name === "category") focusSelect(categoryRef);
    else setFocus(name);
  }

  function focusFirstInvalid(errors: FieldErrors<LogHoursFormInput>) {
    const name = LOG_HOURS_FIELDS.find((field) => errors[field] !== undefined);
    if (name !== undefined) focusField(name);
  }

  function handleError(error: unknown) {
    const result = toLogHoursError(error);

    if (result.kind === "fields") {
      for (const { name, message } of result.fields) setError(name, { type: "server", message });
      focusField(result.fields[0].name);
      return;
    }

    setIssue(result.issue);
  }

  function log(values: LogHoursFormValues) {
    if (isPending || inFlightRef.current || isBlocked) return;
    inFlightRef.current = true;
    setIssue(null);

    const body = toCreateHourEntryBody(values);
    const callbacks = {
      onSuccess: (entry: HourEntryResponseDto) => {
        toast.success(
          member === undefined
            ? t("logHours.toastTitle")
            : t("logHours.toastTitleOnBehalf", { name: member.name }),
          {
            description: t("logHours.toastDescription", {
              hours: formatHours(body.declaredMinutes),
              date: formatDayMonth(body.date, i18n.language),
            }),
          },
        );
        onLogged?.(entry);
        onClose();
      },
      onError: handleError,
      onSettled: () => {
        inFlightRef.current = false;
      },
    };

    if (member === undefined) logMine.mutate({ data: body }, callbacks);
    else logForMember.mutate({ id: member.id, data: body }, callbacks);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit(log, focusFirstInvalid)(event);
  }

  const categoryOptions: SelectOption[] = LOGGABLE_CATEGORIES.map((category) => ({
    id: category,
    label: t(ENTRY_CATEGORY_LABEL_KEYS[category]),
  }));

  const fieldError = (message: string | undefined) =>
    message === undefined ? undefined : t(`logHours.fieldErrors.${message}`);

  // Logging for somebody else is not for everyone: without the permission there is no form at all.
  if (member !== undefined && !canLogForOthers) return null;

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={
        member === undefined
          ? t("logHours.title")
          : t("logHours.titleOnBehalf", { name: member.name })
      }
      closeLabel={t("entries.close")}
      isDismissable={!isPending}
      size="wide"
      aria-describedby={member === undefined ? undefined : noticeId}
      footer={
        <>
          <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
            {t("logHours.cancel")}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={formId}
            isLoading={isPending}
            isDisabled={isBlocked && !isPending}
            aria-describedby={isBlocked ? issueId : undefined}
          >
            {isPending ? t("logHours.submitting") : t("logHours.submit")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        aria-busy={isPending}
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-6"
      >
        {member === undefined ? null : (
          <p
            id={noticeId}
            className="rounded-[10px] bg-tedi-badge px-3.5 py-3 text-base text-tedi-badge-foreground sm:col-span-2"
          >
            {t("logHours.onBehalfNotice", { name: member.name })}
          </p>
        )}

        <div className="sm:col-span-2">
          <Controller
            name="activity"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                label={t("logHours.activity")}
                placeholder={t("logHours.activityPlaceholder")}
                isRequired
                autoFocus
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                errorMessage={fieldError(fieldState.error?.message)}
              />
            )}
          />
        </div>

        <div ref={categoryRef}>
          <Controller
            name="category"
            control={control}
            render={({ field, fieldState }) => (
              <Select
                label={t("logHours.category")}
                placeholder={t("logHours.categoryPlaceholder")}
                isRequired
                options={categoryOptions}
                value={field.value}
                onChange={(value) => field.onChange(toLoggableCategory(value))}
                onBlur={field.onBlur}
                name={field.name}
                errorMessage={fieldError(fieldState.error?.message)}
              />
            )}
          />
        </div>

        <div>
          <Controller
            name="date"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                type="date"
                label={t("logHours.date")}
                isRequired
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                errorMessage={fieldError(fieldState.error?.message)}
              />
            )}
          />
        </div>

        <div>
          <Controller
            name="hours"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                label={t("logHours.hours")}
                placeholder={t("logHours.hoursPlaceholder")}
                isRequired
                autoComplete="off"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                errorMessage={fieldError(fieldState.error?.message)}
              />
            )}
          />
        </div>

        {/* Two columns wide, so it starts a new row: the cell next to Horas stays empty (Vínculo is GUS-172). */}
        <div className="sm:col-span-2">
          <Controller
            name="notes"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                label={t("logHours.notes")}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                errorMessage={fieldError(fieldState.error?.message)}
              />
            )}
          />
        </div>

        {issue === null || display === null ? null : (
          <div id={issueId} ref={issueRef} tabIndex={-1} className="outline-none sm:col-span-2">
            <Alert variant={display.variant}>{t(`logHours.errors.${issueKey}`)}</Alert>
          </div>
        )}
      </form>
    </Dialog>
  );
}
