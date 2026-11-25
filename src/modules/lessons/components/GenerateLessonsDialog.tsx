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
} from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useGenerateClassLessons } from "@api/generated/lessons/lessons";
import { Weekday, type ClassLessonsPreviewResponseDto } from "@api/generated/model";
import { useLiveAnnouncement } from "@shared/hooks/useLiveAnnouncement";
import { formatCalendarDate } from "@shared/lib/format";
import { Alert, Button, Dialog, Select, TextField, toast } from "@shared/ui";

import { useClassLessonsPreview } from "../hooks/useClassLessonsPreview";
import {
  isGenerateLessonsWarning,
  toGenerateLessonsErrorKind,
  type GenerateLessonsErrorKind,
} from "../lib/generate-lessons-errors";
import { invalidateAfterLessonsGenerated } from "../lib/lesson-queries";
import {
  GENERATE_LESSONS_LIMITS,
  generateLessonsFormSchema,
  toGenerateClassLessonsBody,
  toPreviewBody,
  type GenerateLessonsFormInput,
  type GenerateLessonsFormValues,
} from "../schemas/generate-lessons.schema";
import { LessonsPreviewList } from "./LessonsPreviewList";
import { OutsidePeriodWarning } from "./OutsidePeriodWarning";

export interface GenerateLessonsDialogProps {
  classId: string;
  /** The name of the course of the class, which the summary names: the lessons come from its plans. */
  courseName: string;
  /** What "Data da primeira aula" starts with: the first day of the class, so it starts inside the period. */
  defaultFirstDate: string;
  onClose: () => void;
  /**
   * The way to Editar turma, offered by the warning of the lessons outside the period. Without it
   * the warning has no button: it still says to extend the period of the class.
   */
  onEditClass?: () => void;
}

/** The failures of generate that show as an alert: `invalidTimeRange` has a field to point at. */
type AlertErrorKind = Exclude<GenerateLessonsErrorKind, "invalidTimeRange">;

const WEEKDAYS = Object.values(Weekday);

function toWeekday(value: string): Weekday | "" {
  return WEEKDAYS.find((weekday) => weekday === value) ?? "";
}

/**
 * "Gerar aulas da turma" (F4.2, RN-17, RN-18, RN-21): the person chooses the weekday, the times,
 * the date of the first lesson and the usual place, sees the dates each lesson of the plan of the
 * course would get, and generates them all at once. Nothing is created until Gerar N aulas.
 *
 * - **Preview.** Every change to the fields asks the API again, after a pause (`useClassLessonsPreview`):
 *   an incomplete or invalid form asks nothing, and the last list stays on the screen, marked as
 *   busy, until the next one arrives. The preview region is announced to a screen reader when a new
 *   one arrives, since it changes without the focus being there.
 * - **Generate** is on only when the preview on the screen is the one of the fields as they are now
 *   and none of its lessons is outside the period of the class: the API refuses those with 409
 *   `LESSONS_OUTSIDE_CLASS_PERIOD` (decision of GUS-154), so the dialog does not offer it and says
 *   why, with the way to Editar turma when the screen has one. What is sent is the body that was
 *   previewed.
 * - **Rules of the system** (409 `LESSONS_ALREADY_GENERATED`, `COURSE_WITHOUT_SEQUENCE`,
 *   `CLASS_ARCHIVED`) are a warning, not an error, whether they come from the preview or from
 *   generate. A failure of generate shows as an alert that takes the focus; a 400
 *   `INVALID_TIME_RANGE` goes to the field of the end time.
 * - **Success**: the cache of the class and of the lessons is told (`invalidateAfterLessonsGenerated`),
 *   the toast says how many lessons were created and the dialog closes, so the card "Aulas da turma"
 *   behind it already lists them.
 *
 * While generating the dialog cannot be closed (the close button, Escape and Voltar are off) and a
 * second press is ignored: the answer decides what the person sees, and a second `POST` would try
 * to generate the same lessons twice.
 */
export function GenerateLessonsDialog({
  classId,
  courseName,
  defaultFirstDate,
  onClose,
  onEditClass,
}: GenerateLessonsDialogProps): ReactElement {
  const { t, i18n } = useTranslation("lessons");
  const queryClient = useQueryClient();
  const formId = useId();
  const previewTitleId = useId();
  const incompleteId = useId();
  const previewWarningId = useId();
  const outsideWarningId = useId();
  const submitErrorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const announcedDataAtRef = useRef(0);
  const announcedErrorAtRef = useRef(0);
  const [submitError, setSubmitError] = useState<AlertErrorKind | null>(null);
  const { message: announcement, announce } = useLiveAnnouncement();

  const { control, handleSubmit, setError, setFocus } = useForm<
    GenerateLessonsFormInput,
    unknown,
    GenerateLessonsFormValues
  >({
    resolver: zodResolver(generateLessonsFormSchema),
    mode: "onTouched",
    defaultValues: {
      weekday: "",
      startTime: "",
      endTime: "",
      firstDate: defaultFirstDate,
      location: "",
    },
  });

  const [weekday, startTime, endTime, firstDate, location] = useWatch({
    control,
    name: ["weekday", "startTime", "endTime", "firstDate", "location"],
  });
  const body = useMemo(
    () => toPreviewBody({ weekday, startTime, endTime, firstDate, location }),
    [weekday, startTime, endTime, firstDate, location],
  );

  // A failure is about the fields it came with: once they change it is about something else, so it
  // goes. What is still true of the class (a rule) comes back from the preview of the new fields.
  // The state is reset while rendering, as React asks for a state that follows another, and `body`
  // is the same object until a field changes.
  const [bodyOfFailure, setBodyOfFailure] = useState(body);
  if (body !== bodyOfFailure) {
    setBodyOfFailure(body);
    setSubmitError(null);
  }

  const { query, isCurrent } = useClassLessonsPreview(classId, body);
  const previewData = query.data;
  const previewKind = query.isError ? toGenerateLessonsErrorKind(query.error) : null;

  const generate = useGenerateClassLessons({
    mutation: {
      // The cache is told even if the dialog is gone by the time the answer arrives.
      onSuccess: (_response, { id }) => void invalidateAfterLessonsGenerated(queryClient, id),
    },
  });
  const isPending = generate.isPending;

  const outsideCount = previewData?.outsideClassPeriodCount ?? 0;
  const canGenerate = isCurrent && outsideCount === 0 && !isPending;

  // The preview and generate can refuse for the same rule: one warning says it, not two.
  const previewRule =
    previewKind !== null && isGenerateLessonsWarning(previewKind) && previewKind !== submitError
      ? previewKind
      : null;

  const describePreview = useCallback(
    (data: ClassLessonsPreviewResponseDto): string => {
      const first = data.items.at(0);
      const last = data.items.at(-1);
      if (first === undefined || last === undefined) return "";

      const dates = {
        count: data.lessonCount,
        first: formatCalendarDate(first.date, i18n.language),
        last: formatCalendarDate(last.date, i18n.language),
      };
      const outside =
        data.outsideClassPeriodCount > 0
          ? ` ${t("generate.preview.announcementOutside", { count: data.outsideClassPeriodCount })}`
          : "";

      return `${t("generate.preview.announcement", dates)}${outside}`;
    },
    [t, i18n.language],
  );

  // The preview changes while the focus is on a field, so a screen reader hears it from a live
  // region. Only a new answer is told (not the one kept from before, nor the same one twice).
  const { isPlaceholderData, isFetching, dataUpdatedAt, errorUpdatedAt } = query;
  useEffect(() => {
    if (
      previewData === undefined ||
      isPlaceholderData ||
      isFetching ||
      dataUpdatedAt === announcedDataAtRef.current
    ) {
      return;
    }
    announcedDataAtRef.current = dataUpdatedAt;
    const message = describePreview(previewData);
    if (message !== "") announce(message);
  }, [previewData, isPlaceholderData, isFetching, dataUpdatedAt, announce, describePreview]);

  // A rule that refuses the preview is a warning with no live region of its own: say its title.
  useEffect(() => {
    if (previewRule === null || errorUpdatedAt === announcedErrorAtRef.current) return;
    announcedErrorAtRef.current = errorUpdatedAt;
    announce(t(`generate.errors.${previewRule}.title`));
  }, [previewRule, errorUpdatedAt, announce, t]);

  useEffect(() => {
    if (submitError !== null) submitErrorRef.current?.focus();
  }, [submitError]);

  function handleError(error: unknown) {
    const kind = toGenerateLessonsErrorKind(error);

    if (kind === "invalidTimeRange") {
      setError("endTime", { type: "server", message: "endTimeBeforeStart" });
      setFocus("endTime");
      return;
    }

    setSubmitError(kind);
    // The period of the class changed after the preview: ask again, so the list marks the lessons.
    if (kind === "outsideClassPeriod") void query.refetch();
    // Somebody else generated them first: the card behind the dialog has to show the lessons.
    if (kind === "alreadyGenerated") void invalidateAfterLessonsGenerated(queryClient, classId);
  }

  function generateLessons(values: GenerateLessonsFormValues) {
    if (!canGenerate || inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitError(null);

    generate.mutate(
      { id: classId, data: toGenerateClassLessonsBody(values) },
      {
        onSuccess: (response) => {
          toast.success(t("generate.success", { count: response.lessons.length }));
          onClose();
        },
        onError: handleError,
        onSettled: () => {
          inFlightRef.current = false;
        },
      },
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit(generateLessons)(event);
  }

  const lessonCount = previewData?.lessonCount;
  const submitLabel = isPending
    ? t("generate.submitting")
    : lessonCount === undefined
      ? t("generate.submitIdle")
      : t("generate.submit", { count: lessonCount });

  // What turns Gerar off, said where the person can read it: a disabled button takes no focus.
  const disabledReasonId = canGenerate
    ? undefined
    : previewRule !== null
      ? previewWarningId
      : outsideCount > 0
        ? outsideWarningId
        : body === null
          ? incompleteId
          : undefined;

  const skippedPlans = previewData?.skippedLessonPlans ?? [];
  const skippedText =
    skippedPlans.length === 0
      ? null
      : t("generate.skipped", {
          count: skippedPlans.length,
          titles: new Intl.ListFormat(i18n.language, { type: "conjunction" }).format(
            skippedPlans.map((plan) => t("generate.quote", { title: plan.title })),
          ),
        });

  const weekdayOptions = WEEKDAYS.map((id) => ({ id, label: t(`weekdays.${id}`) }));
  const fieldError = (message: string | undefined) =>
    message ? t(`generate.fieldErrors.${message}`, GENERATE_LESSONS_LIMITS) : undefined;

  // On the right of the title of the preview: what is happening to it, or what it is.
  let previewNote: string | null = null;
  if (body !== null && !isCurrent && previewKind === null) {
    previewNote = t("generate.preview.loading");
  } else if (previewData !== undefined && isCurrent) {
    previewNote = t(`generate.preview.schedule.${previewData.weekday}`, {
      start: previewData.startTime,
      end: previewData.endTime,
    });
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      size="wide"
      title={t("generate.title")}
      closeLabel={t("close")}
      isDismissable={!isPending}
      footer={
        <>
          <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
            {t("generate.back")}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={formId}
            isLoading={isPending}
            isDisabled={!canGenerate && !isPending}
            aria-describedby={disabledReasonId}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        aria-busy={isPending}
        onSubmit={onSubmit}
        className="flex flex-col gap-5"
      >
        <Alert
          variant="info"
          // The description of the info alert is `text-muted`, which is 3,9:1 on its blue
          // background (under 4,5:1), so the text takes the foreground color (15:1).
          description={
            <span className="text-foreground">
              {t("generate.summaryDescription", { course: courseName })}
              {skippedText === null ? null : ` ${skippedText}`}
            </span>
          }
        >
          {lessonCount === undefined
            ? t("generate.summaryPending")
            : t("generate.summaryTitle", { count: lessonCount })}
        </Alert>

        <div className="grid gap-6 sm:grid-cols-3">
          <Controller
            name="weekday"
            control={control}
            render={({ field, fieldState }) => (
              <Select
                label={t("generate.fields.weekday")}
                placeholder={t("generate.fields.weekdayPlaceholder")}
                options={weekdayOptions}
                value={field.value === "" ? null : field.value}
                onChange={(value) => field.onChange(toWeekday(value))}
                onBlur={field.onBlur}
                name={field.name}
                isRequired
                autoFocus
                errorMessage={fieldError(fieldState.error?.message)}
              />
            )}
          />
          <Controller
            name="startTime"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                label={t("generate.fields.startTime")}
                type="time"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                autoComplete="off"
                isRequired
                errorMessage={fieldError(fieldState.error?.message)}
              />
            )}
          />
          <Controller
            name="endTime"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                label={t("generate.fields.endTime")}
                type="time"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                autoComplete="off"
                isRequired
                errorMessage={fieldError(fieldState.error?.message)}
              />
            )}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Controller
            name="firstDate"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                label={t("generate.fields.firstDate")}
                description={t("generate.fields.firstDateHint")}
                type="date"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                autoComplete="off"
                isRequired
                errorMessage={fieldError(fieldState.error?.message)}
              />
            )}
          />
          <Controller
            name="location"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                label={t("generate.fields.location")}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                autoComplete="off"
                errorMessage={fieldError(fieldState.error?.message)}
              />
            )}
          />
        </div>

        <section aria-labelledby={previewTitleId} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 id={previewTitleId} className="text-base font-semibold text-foreground">
              {t("generate.preview.title")}
            </h3>
            {previewNote === null ? null : <p className="text-sm text-muted">{previewNote}</p>}
          </div>
          {body === null ? (
            <p id={incompleteId} className="text-base text-muted">
              {t("generate.preview.incomplete")}
            </p>
          ) : null}
          {previewData === undefined ? null : (
            <LessonsPreviewList preview={previewData} isBusy={!isCurrent} />
          )}
        </section>

        {previewData !== undefined && outsideCount > 0 ? (
          <OutsidePeriodWarning
            id={outsideWarningId}
            preview={previewData}
            onEditClass={
              onEditClass === undefined
                ? undefined
                : () => {
                    onClose();
                    onEditClass();
                  }
            }
          />
        ) : null}

        {previewRule === null ? null : (
          <div id={previewWarningId}>
            <Alert variant="warning" description={t(`generate.errors.${previewRule}.description`)}>
              {t(`generate.errors.${previewRule}.title`)}
            </Alert>
          </div>
        )}

        {previewKind === null || isGenerateLessonsWarning(previewKind) ? null : (
          <div className="flex flex-col items-start gap-3">
            {previewKind === "classNotFound" ? (
              <Alert variant="error" description={t("generate.errors.classNotFound.description")}>
                {t("generate.errors.classNotFound.title")}
              </Alert>
            ) : (
              <Alert variant="error">
                {previewKind === "invalidTimeRange"
                  ? t("generate.fieldErrors.endTimeBeforeStart")
                  : t("generate.preview.error")}
              </Alert>
            )}
            {previewKind === "network" || previewKind === "unknown" ? (
              <Button
                variant="secondary"
                isLoading={query.isFetching}
                onPress={() => void query.refetch()}
              >
                {t("retry")}
              </Button>
            ) : null}
          </div>
        )}

        {submitError === null ? null : (
          <div ref={submitErrorRef} tabIndex={-1} className="outline-none">
            <Alert
              variant={isGenerateLessonsWarning(submitError) ? "warning" : "error"}
              description={t(`generate.errors.${submitError}.description`)}
            >
              {t(`generate.errors.${submitError}.title`)}
            </Alert>
          </div>
        )}

        <p role="status" className="sr-only">
          {announcement}
        </p>
      </form>
    </Dialog>
  );
}
