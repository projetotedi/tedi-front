import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import {
  useCreateLessonPlan,
  useGetLessonPlan,
  useUpdateLessonPlan,
} from "@api/generated/catalog/catalog";
import type {
  CreateLessonPlanDto,
  LessonPlanDetailDto,
  LessonPlanResponseDto,
  LessonPlanUsageResponseDto,
} from "@api/generated/model";
import chevronDownIcon from "@shared/assets/icons/chevron-down.svg";
import trashBinIcon from "@shared/assets/icons/trash-bin.svg";
import { Alert, Button, Dialog, Skeleton, TextArea, TextField, toast } from "@shared/ui";

import {
  resolveLessonPlanField,
  toRequestErrorKind,
  toSubmitError,
  type SubmitErrorKind,
} from "../lib/api-form-errors";
import { fetchLessonPlanUsage, invalidateLessonPlans } from "../lib/lesson-plan-queries";
import { needsUsageConfirmation } from "../lib/lesson-plan-usage";
import {
  buildEmptyFormValues,
  LESSON_PLAN_LIMITS,
  lessonPlanFormSchema,
  toFormValues,
  toLessonPlanBody,
  type LessonPlanFormValues,
} from "../schemas/lesson-plan.schema";
import { ConfirmLessonPlanChangeDialog } from "./ConfirmLessonPlanChangeDialog";

const MIN_CONTENTS = 1;

interface DialogCallbacks {
  onClose: () => void;
  onSaved?: (plan: LessonPlanResponseDto) => void;
}

export type LessonPlanFormDialogProps =
  | (DialogCallbacks & { mode: "create" })
  | (DialogCallbacks & { mode: "edit"; lessonPlanId: string });

type ContentAction = "up" | "down";

type PendingFocus =
  | { kind: "input"; index: number }
  | { kind: "action"; rowId: string; action: ContentAction };

function RequiredLabel({ children }: { children: ReactNode }): ReactElement {
  return (
    <>
      {children}
      <span className="ms-0.5 text-danger" aria-hidden="true">
        *
      </span>
    </>
  );
}

function LoadingPlaceholder({ label }: { label: string }): ReactElement {
  return (
    <div role="status" className="flex flex-col gap-4">
      <p className="sr-only">{label}</p>
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-11 w-1/2 rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}

/** What the RF-017 check needs to know about the plan being edited. */
type CurrentPlan = Pick<LessonPlanDetailDto, "status" | "expectedDurationMinutes">;

/** A change that waits for the person to confirm it, with the usage that justified asking. */
interface PendingChange {
  data: CreateLessonPlanDto;
  usage: LessonPlanUsageResponseDto;
}

interface LessonPlanFormProps {
  formId: string;
  lessonPlanId: string | null;
  currentPlan: CurrentPlan | null;
  initialValues: LessonPlanFormValues;
  onPendingChange: (isPending: boolean) => void;
  onSaved: (plan: LessonPlanResponseDto) => void;
}

function LessonPlanForm({
  formId,
  lessonPlanId,
  currentPlan,
  initialValues,
  onPendingChange,
  onSaved,
}: LessonPlanFormProps): ReactElement {
  const { t } = useTranslation("catalog");
  const queryClient = useQueryClient();
  const idPrefix = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const pendingFocusRef = useRef<PendingFocus | null>(null);
  const [submitError, setSubmitError] = useState<SubmitErrorKind | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);

  const { control, handleSubmit, setError, setFocus } = useForm<LessonPlanFormValues>({
    resolver: zodResolver(lessonPlanFormSchema),
    defaultValues: initialValues,
  });
  const { fields, append, remove, move } = useFieldArray({ control, name: "contents" });

  function afterSave(messageKey: string) {
    return () => {
      toast.success(t(messageKey));
      void invalidateLessonPlans(queryClient);
    };
  }

  const createPlan = useCreateLessonPlan({ mutation: { onSuccess: afterSave("toast.created") } });
  const updatePlan = useUpdateLessonPlan({ mutation: { onSuccess: afterSave("toast.updated") } });
  const isPending = createPlan.isPending || updatePlan.isPending;

  const actionId = useCallback(
    (rowId: string, action: ContentAction) => `${idPrefix}-content-${rowId}-${action}`,
    [idPrefix],
  );

  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (pending === null) return;
    pendingFocusRef.current = null;

    if (pending.kind === "input") {
      setFocus(`contents.${pending.index}.value`);
      return;
    }

    const preferred = document.getElementById(actionId(pending.rowId, pending.action));
    const other = document.getElementById(
      actionId(pending.rowId, pending.action === "up" ? "down" : "up"),
    );
    const isPreferredUsable = preferred instanceof HTMLButtonElement && !preferred.disabled;
    (isPreferredUsable ? preferred : other)?.focus();
  }, [fields, actionId, setFocus]);

  useEffect(() => {
    if (submitError !== null) errorRef.current?.focus();
  }, [submitError]);

  function errorText(message: string | undefined): string | undefined {
    return message ? t(`form.errors.${message}`, LESSON_PLAN_LIMITS) : undefined;
  }

  function handleError(error: unknown) {
    const result = toSubmitError(error, resolveLessonPlanField);

    if (result.kind === "fields") {
      for (const { name, message } of result.fields) setError(name, { type: "server", message });
      setFocus(result.fields[0].name);
      return;
    }
    setSubmitError(result.kind);
  }

  function startSaving() {
    inFlightRef.current = true;
    setSubmitError(null);
    onPendingChange(true);
  }

  function stopSaving() {
    inFlightRef.current = false;
    onPendingChange(false);
  }

  /** Sends the plan. The caller already holds the double-submit guard (`startSaving`). */
  function submit(data: CreateLessonPlanDto) {
    const callbacks = {
      onSuccess: (plan: LessonPlanResponseDto) => onSaved(plan),
      onError: (error: unknown) => {
        // The confirmation traps the focus while it is open. Close it first, so that the focus that
        // `handleError` sends to the invalid field or to the alert is not pulled back into it.
        flushSync(() => setPendingChange(null));
        handleError(error);
      },
      onSettled: stopSaving,
    };

    if (lessonPlanId === null) createPlan.mutate({ data }, callbacks);
    else updatePlan.mutate({ id: lessonPlanId, data }, callbacks);
  }

  /**
   * RF-017: a plan that courses use and whose duration changed asks the API what the change does to
   * each course and waits for the person to confirm. Failing to ask blocks the save (the person
   * would be confirming blind); a plan that turns out to be in no course is saved right away.
   */
  async function save(values: LessonPlanFormValues) {
    if (isPending || inFlightRef.current) return;
    startSaving();

    const data = toLessonPlanBody(values);

    if (
      lessonPlanId !== null &&
      currentPlan !== null &&
      needsUsageConfirmation(currentPlan, data.expectedDurationMinutes)
    ) {
      try {
        const usage = await fetchLessonPlanUsage(
          queryClient,
          lessonPlanId,
          data.expectedDurationMinutes,
        );
        if (usage.courses.length > 0) {
          setPendingChange({ data, usage });
          stopSaving();
          return;
        }
      } catch (error) {
        handleError(error);
        stopSaving();
        return;
      }
    }

    submit(data);
  }

  function confirmPendingChange() {
    if (pendingChange === null || isPending || inFlightRef.current) return;
    startSaving();
    submit(pendingChange.data);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit(save)(event);
  }

  function addContent() {
    append({ value: "" });
  }

  function moveContent(index: number, offset: -1 | 1) {
    const target = index + offset;
    move(index, target);
    pendingFocusRef.current = {
      kind: "action",
      rowId: fields[index].id,
      action: offset === -1 ? "up" : "down",
    };
    setAnnouncement(
      t("form.contentMoved", { number: index + 1, position: target + 1, total: fields.length }),
    );
  }

  function removeContent(index: number) {
    remove(index);
    pendingFocusRef.current = { kind: "input", index: Math.min(index, fields.length - 2) };
    setAnnouncement(t("form.contentRemoved", { number: index + 1, count: fields.length - 1 }));
  }

  const durationLabelId = `${idPrefix}-duration-label`;
  const durationHelpId = `${idPrefix}-duration-help`;
  const contentsLabelId = `${idPrefix}-contents-label`;
  const contentsHelpId = `${idPrefix}-contents-help`;
  const isAtContentsLimit = fields.length >= LESSON_PLAN_LIMITS.contentsMax;

  return (
    <form
      id={formId}
      noValidate
      aria-busy={isPending}
      onSubmit={onSubmit}
      className="flex flex-col gap-4"
    >
      <Controller
        name="title"
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            label={t("form.title")}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            inputRef={field.ref}
            isRequired
            autoFocus
            errorMessage={errorText(fieldState.error?.message)}
          />
        )}
      />

      <div
        role="group"
        aria-labelledby={durationLabelId}
        aria-describedby={durationHelpId}
        className="flex flex-col gap-2"
      >
        <span id={durationLabelId} className="text-base font-medium text-foreground">
          <RequiredLabel>{t("form.duration")}</RequiredLabel>
        </span>
        <div className="grid max-w-xl grid-cols-2 gap-4">
          <Controller
            name="hours"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                label={t("form.hours")}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                inputMode="numeric"
                autoComplete="off"
                errorMessage={errorText(fieldState.error?.message)}
              />
            )}
          />
          <Controller
            name="minutes"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                label={t("form.minutes")}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                inputMode="numeric"
                autoComplete="off"
                errorMessage={errorText(fieldState.error?.message)}
              />
            )}
          />
        </div>
        <p id={durationHelpId} className="text-sm text-muted">
          {t("form.durationHelp")}
        </p>
      </div>

      <div
        role="group"
        aria-labelledby={contentsLabelId}
        aria-describedby={contentsHelpId}
        className="flex flex-col gap-2"
      >
        <span id={contentsLabelId} className="text-base font-medium text-foreground">
          <RequiredLabel>{t("form.contents")}</RequiredLabel>
        </span>
        <p id={contentsHelpId} className="text-sm text-muted">
          {t("form.contentsHelp")}
        </p>
        <ol role="list" className="flex flex-col gap-3">
          {fields.map((item, index) => (
            <li key={item.id} className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <Controller
                  name={`contents.${index}.value`}
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      label={t("form.content", { number: index + 1 })}
                      isLabelHidden
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      inputRef={field.ref}
                      isRequired
                      errorMessage={errorText(fieldState.error?.message)}
                    />
                  )}
                />
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  id={actionId(item.id, "up")}
                  variant="ghost"
                  isIconOnly
                  aria-label={t("form.moveUp", { number: index + 1 })}
                  isDisabled={index === 0}
                  onPress={() => moveContent(index, -1)}
                >
                  <img
                    src={chevronDownIcon}
                    alt=""
                    aria-hidden="true"
                    width={16}
                    height={16}
                    className="rotate-180"
                  />
                </Button>
                <Button
                  id={actionId(item.id, "down")}
                  variant="ghost"
                  isIconOnly
                  aria-label={t("form.moveDown", { number: index + 1 })}
                  isDisabled={index === fields.length - 1}
                  onPress={() => moveContent(index, 1)}
                >
                  <img src={chevronDownIcon} alt="" aria-hidden="true" width={16} height={16} />
                </Button>
                <Button
                  variant="ghost"
                  isIconOnly
                  aria-label={t("form.removeContent", { number: index + 1 })}
                  isDisabled={fields.length <= MIN_CONTENTS}
                  onPress={() => removeContent(index)}
                >
                  <img src={trashBinIcon} alt="" aria-hidden="true" width={16} height={16} />
                </Button>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-col items-start gap-2">
          <Button variant="secondary" isDisabled={isAtContentsLimit} onPress={addContent}>
            {t("form.addContent")}
          </Button>
          {isAtContentsLimit ? (
            <p className="text-sm text-muted">{t("form.contentsLimit", LESSON_PLAN_LIMITS)}</p>
          ) : null}
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </div>

      <Controller
        name="objective"
        control={control}
        render={({ field, fieldState }) => (
          <TextArea
            label={t("form.objective")}
            rows={5}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            inputRef={field.ref}
            errorMessage={errorText(fieldState.error?.message)}
          />
        )}
      />

      <Controller
        name="materialUrl"
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            label={t("form.material")}
            description={t("form.materialHelp")}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            inputRef={field.ref}
            inputMode="url"
            autoComplete="off"
            errorMessage={errorText(fieldState.error?.message)}
          />
        )}
      />

      {submitError !== null ? (
        <div ref={errorRef} tabIndex={-1} className="outline-none">
          <Alert variant="error">{t(`errors.${submitError}`)}</Alert>
        </div>
      ) : null}

      {pendingChange !== null ? (
        <ConfirmLessonPlanChangeDialog
          usage={pendingChange.usage}
          isSaving={updatePlan.isPending}
          onConfirm={confirmPendingChange}
          onBack={() => setPendingChange(null)}
        />
      ) : null}
    </form>
  );
}

export function LessonPlanFormDialog(props: LessonPlanFormDialogProps): ReactElement {
  const { onClose, onSaved } = props;
  const lessonPlanId = props.mode === "edit" ? props.lessonPlanId : null;
  const { t } = useTranslation("catalog");
  const formId = useId();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const planQuery = useGetLessonPlan(lessonPlanId ?? "", {
    query: { enabled: lessonPlanId !== null, staleTime: 0, gcTime: 0, refetchOnMount: "always" },
  });
  const plan = planQuery.data;
  const isArchived = plan !== undefined && plan.archivedAt !== null;
  const isReady = lessonPlanId === null || (plan !== undefined && !isArchived);
  const initialValues = useMemo(() => (plan ? toFormValues(plan) : buildEmptyFormValues()), [plan]);

  function handleSaved(saved: LessonPlanResponseDto) {
    onSaved?.(saved);
    onClose();
  }

  function renderBody(): ReactElement {
    if (lessonPlanId !== null) {
      if (planQuery.isPending) return <LoadingPlaceholder label={t("form.loading")} />;

      if (plan === undefined) {
        return (
          <div className="flex flex-col items-start gap-3">
            <Alert variant="error">{t(`errors.${toRequestErrorKind(planQuery.error)}`)}</Alert>
            <Button
              variant="secondary"
              isLoading={planQuery.isFetching}
              onPress={() => void planQuery.refetch()}
            >
              {t("form.retry")}
            </Button>
          </div>
        );
      }

      if (isArchived) return <Alert variant="error">{t("errors.archived")}</Alert>;
    }

    return (
      <LessonPlanForm
        key={lessonPlanId ?? "new"}
        formId={formId}
        lessonPlanId={lessonPlanId}
        currentPlan={plan ?? null}
        initialValues={initialValues}
        onPendingChange={setIsSubmitting}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={lessonPlanId === null ? t("form.newTitle") : t("form.editTitle")}
      closeLabel={t("close")}
      size="wide"
      isDismissable={!isSubmitting}
      footer={
        <>
          <Button variant="secondary" isDisabled={isSubmitting} onPress={onClose}>
            {t("form.cancel")}
          </Button>
          <Button type="submit" form={formId} isLoading={isSubmitting} isDisabled={!isReady}>
            {isSubmitting
              ? t("form.saving")
              : lessonPlanId === null
                ? t("form.savePlan")
                : t("form.saveChanges")}
          </Button>
        </>
      }
    >
      {renderBody()}
    </Dialog>
  );
}
