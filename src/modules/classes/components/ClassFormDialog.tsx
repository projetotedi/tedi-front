import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { Controller, useForm, type FieldErrors } from "react-hook-form";
import { useTranslation } from "react-i18next";

import {
  useCreateClass,
  useGetClass,
  useListEditions,
  useUpdateClass,
} from "@api/generated/classes/classes";
import { ClassStatus, type ClassDetailDto, type ClassResponseDto } from "@api/generated/model";
import {
  Alert,
  Button,
  Combobox,
  DatePicker,
  Dialog,
  Select,
  Skeleton,
  TextField,
  toast,
} from "@shared/ui";

import { useCourseOptions } from "../hooks/useCourseOptions";
import { toClassFormError } from "../lib/class-errors";
import { invalidateAfterClassChanged } from "../lib/class-queries";
import { CLASS_STATUS_LABEL_KEYS } from "../lib/class-status";
import { canChangeCourse } from "../lib/course-options";
import {
  CLASS_FORM_LIMITS,
  classFormSchema,
  emptyClassFormValues,
  toClassFormValues,
  toCreateClassBody,
  toUpdateClassBody,
  type ClassFormFieldName,
  type ClassFormValues,
} from "../schemas/class-form.schema";
import { CourseSelect } from "./CourseSelect";

/** The fields in the order of the Figma: the focus goes to the first one with an error. */
const FIELD_ORDER: readonly ClassFormFieldName[] = [
  "courseId",
  "code",
  "edition",
  "start",
  "end",
  "location",
  "capacity",
  "status",
];

const FOCUSABLE = "input:not(:disabled), button:not(:disabled), [role='spinbutton']";

export interface ClassFormDialogProps {
  /** The class to edit. Without it the dialog creates a new class. */
  classId?: string;
  /** The course a new class starts with, when the dialog is opened from the screen of a course. */
  initialCourseId?: string;
  onClose: () => void;
  onSaved?: (saved: ClassResponseDto) => void;
}

function RequiredLabel({ children }: { children: ReactNode }): ReactElement {
  return (
    <>
      {children}{" "}
      <span className="text-danger" aria-hidden="true">
        *
      </span>
    </>
  );
}

interface ClassFormProps {
  formId: string;
  classDetail?: ClassDetailDto;
  initialValues: ClassFormValues;
  onClose: () => void;
  onSaved?: (saved: ClassResponseDto) => void;
  onPendingChange: (isPending: boolean) => void;
}

function ClassForm({
  formId,
  classDetail,
  initialValues,
  onClose,
  onSaved,
  onPendingChange,
}: ClassFormProps): ReactElement {
  const { t } = useTranslation("classes");
  const queryClient = useQueryClient();
  const { courses } = useCourseOptions();
  const editionsQuery = useListEditions();
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const isEditing = classDetail !== undefined;

  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const isPending = createClass.isPending || updateClass.isPending;

  useEffect(() => onPendingChange(isPending), [isPending, onPendingChange]);
  useEffect(() => {
    if (alertMessage !== null) errorRef.current?.focus();
  }, [alertMessage]);

  const { control, handleSubmit, setError } = useForm<ClassFormValues>({
    resolver: zodResolver(classFormSchema),
    defaultValues: initialValues,
  });

  // The course can change only while the class is planned and has no enrollment. What counts is the
  // status the class has SAVED (P11), not the one picked in this form. The field is turned off, not
  // left out of the form, so the course goes on being the one of the class.
  const isCourseLocked =
    isEditing &&
    !canChangeCourse({
      status: classDetail.status,
      enrolledCount: classDetail.summary.enrolledCount,
    });

  const statusOptions = Object.values(ClassStatus).map((status) => ({
    id: status,
    label: t(CLASS_STATUS_LABEL_KEYS[status]),
  }));
  const editionOptions = (editionsQuery.data ?? []).map((edition) => edition.name);

  function focusField(name: ClassFormFieldName) {
    formRef.current
      ?.querySelector<HTMLElement>(`[data-field="${name}"]`)
      ?.querySelector<HTMLElement>(FOCUSABLE)
      ?.focus();
  }

  function fieldError(message: string | undefined) {
    return message ? t(`form.errors.${message}`, CLASS_FORM_LIMITS) : undefined;
  }

  function onInvalid(errors: FieldErrors<ClassFormValues>) {
    const first = FIELD_ORDER.find((name) => errors[name] !== undefined);
    if (first) focusField(first);
  }

  function handleError(error: unknown) {
    const result = toClassFormError(error);

    if (result.kind === "action") {
      setAlertMessage(t(`actionErrors.${result.error}`));
      return;
    }
    if (result.kind === "lessonsOutsidePeriod") {
      setAlertMessage(
        result.count !== null
          ? t("actionErrors.lessonsOutsidePeriod", { count: result.count })
          : t("actionErrors.lessonsOutsidePeriodUnknown"),
      );
      return;
    }
    if (result.name === "courseId" && isCourseLocked) {
      // A field that is off cannot take the focus, so the alert above the buttons says it.
      setAlertMessage(fieldError(result.message) ?? null);
      return;
    }
    setError(result.name, { type: "server", message: result.message });
    focusField(result.name);
  }

  function handleSuccess(saved: ClassResponseDto) {
    toast.success(t(isEditing ? "form.updated" : "form.created"));
    void invalidateAfterClassChanged(queryClient, saved);
    onSaved?.(saved);
    onClose();
  }

  function save(values: ClassFormValues) {
    if (isPending || inFlightRef.current) return;
    inFlightRef.current = true;
    setAlertMessage(null);
    const callbacks = {
      onSuccess: handleSuccess,
      onError: handleError,
      onSettled: () => {
        inFlightRef.current = false;
      },
    };

    if (classDetail) {
      const body = toUpdateClassBody(values, initialValues);
      if (Object.keys(body).length === 0) {
        inFlightRef.current = false;
        onClose();
        return;
      }
      updateClass.mutate({ id: classDetail.id, data: body }, callbacks);
    } else {
      createClass.mutate({ data: toCreateClassBody(values) }, callbacks);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit(save, onInvalid)(event);
  }

  return (
    <form
      ref={formRef}
      id={formId}
      noValidate
      aria-busy={isPending}
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <Controller
        name="courseId"
        control={control}
        render={({ field, fieldState }) => (
          <div data-field="courseId">
            <CourseSelect
              label={<RequiredLabel>{t("course")}</RequiredLabel>}
              courses={courses}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              currentCourseId={classDetail?.course.id}
              isDisabled={isCourseLocked}
              description={isCourseLocked ? t("form.courseLockedHint") : undefined}
              isRequired
              autoFocus={!isCourseLocked}
              errorMessage={fieldError(fieldState.error?.message)}
            />
          </div>
        )}
      />
      <div className="hidden sm:block" aria-hidden="true" />

      <Controller
        name="code"
        control={control}
        render={({ field, fieldState }) => (
          <div data-field="code">
            <TextField
              label={<RequiredLabel>{t("code")}</RequiredLabel>}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              placeholder={t("form.codePlaceholder")}
              isRequired
              autoFocus={isCourseLocked}
              errorMessage={fieldError(fieldState.error?.message)}
            />
          </div>
        )}
      />

      <Controller
        name="edition"
        control={control}
        render={({ field, fieldState }) => (
          <div data-field="edition">
            <Combobox
              label={<RequiredLabel>{t("edition")}</RequiredLabel>}
              options={editionOptions}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              placeholder={t("form.editionPlaceholder")}
              description={t("form.editionHint")}
              isRequired
              errorMessage={fieldError(fieldState.error?.message)}
            />
          </div>
        )}
      />

      <Controller
        name="start"
        control={control}
        render={({ field, fieldState }) => (
          <div data-field="start">
            <DatePicker
              label={<RequiredLabel>{t("start")}</RequiredLabel>}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              isRequired
              errorMessage={fieldError(fieldState.error?.message)}
            />
          </div>
        )}
      />

      <Controller
        name="end"
        control={control}
        render={({ field, fieldState }) => (
          <div data-field="end">
            <DatePicker
              label={<RequiredLabel>{t("end")}</RequiredLabel>}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              isRequired
              errorMessage={fieldError(fieldState.error?.message)}
            />
          </div>
        )}
      />

      <Controller
        name="location"
        control={control}
        render={({ field, fieldState }) => (
          <div data-field="location">
            <TextField
              label={t("location")}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              placeholder={t("form.locationPlaceholder")}
              errorMessage={fieldError(fieldState.error?.message)}
            />
          </div>
        )}
      />

      <Controller
        name="capacity"
        control={control}
        render={({ field, fieldState }) => (
          <div data-field="capacity">
            <TextField
              label={<RequiredLabel>{t("capacity")}</RequiredLabel>}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputMode="numeric"
              isRequired
              errorMessage={fieldError(fieldState.error?.message)}
            />
          </div>
        )}
      />

      <Controller
        name="status"
        control={control}
        render={({ field }) => (
          <div data-field="status">
            <Select
              label={t("status")}
              options={statusOptions}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
            />
          </div>
        )}
      />

      {alertMessage !== null ? (
        <div ref={errorRef} tabIndex={-1} className="outline-none sm:col-span-2">
          <Alert variant="error">{alertMessage}</Alert>
        </div>
      ) : null}
    </form>
  );
}

function FormSkeleton({ label }: { label: string }): ReactElement {
  return (
    <div role="status" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <p className="sr-only">{label}</p>
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

/**
 * Nova turma and Editar turma (RF-024, RF-034, GUS-133), as in the Figma: Curso, Código da turma
 * and Edição, Data de início and Data de término, Local and Vagas totais, and Status. A class has no
 * name to type nor a level: the level is the category of its course (RN-14).
 *
 * - Curso offers only the active courses; when editing, the course of the class stays on the list
 *   even if it was archived, and it is turned off with a hint once the class is no longer planned or
 *   has students (`canChangeCourse`).
 * - Edição suggests the editions that exist (`listEditions`) and takes a new one typed as
 *   "2026.2": the API creates it on demand.
 * - A period that ends before it starts is stopped here; the refusals of the API go to their field,
 *   with the focus (`toClassFormError`): the code taken in the edition, the period, the seats below
 *   the students and the course.
 * - Editing sends only what changed (`toUpdateClassBody`); saving with nothing changed just closes.
 *
 * The class to edit comes from `getClass`, which the screen of the class already holds. After the
 * save, a toast says it, the lists and the detail are fetched again (`invalidateAfterClassChanged`)
 * and the dialog closes: the screen that opened it stays where it was.
 */
export function ClassFormDialog({
  classId,
  initialCourseId,
  onClose,
  onSaved,
}: ClassFormDialogProps): ReactElement {
  const { t } = useTranslation("classes");
  const formId = useId();
  const [isPending, setIsPending] = useState(false);
  const isEditing = classId !== undefined;
  const classQuery = useGetClass(classId ?? "", { query: { enabled: isEditing } });
  const classDetail = classQuery.data;

  let body: ReactElement;
  if (!isEditing) {
    body = (
      <ClassForm
        formId={formId}
        initialValues={emptyClassFormValues(initialCourseId)}
        onClose={onClose}
        onSaved={onSaved}
        onPendingChange={setIsPending}
      />
    );
  } else if (classDetail) {
    body = (
      <ClassForm
        formId={formId}
        classDetail={classDetail}
        initialValues={toClassFormValues(classDetail)}
        onClose={onClose}
        onSaved={onSaved}
        onPendingChange={setIsPending}
      />
    );
  } else if (classQuery.isPending) {
    body = <FormSkeleton label={t("form.loading")} />;
  } else {
    body = (
      <div className="flex flex-col items-start gap-3">
        <Alert variant="error">{t("form.loadError")}</Alert>
        <Button
          variant="secondary"
          isLoading={classQuery.isFetching}
          onPress={() => void classQuery.refetch()}
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  const canSubmit = !isEditing || classDetail !== undefined;

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={isEditing ? t("editTitle") : t("newTitle")}
      closeLabel={t("close")}
      isDismissable={!isPending}
      size="wide"
      footer={
        <>
          <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={formId} isLoading={isPending} isDisabled={!canSubmit}>
            {isPending ? t("form.saving") : isEditing ? t("saveChanges") : t("saveClass")}
          </Button>
        </>
      }
    >
      {body}
    </Dialog>
  );
}
