import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useRef, type FormEvent, type ReactElement, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { ClassStatus } from "@api/generated/model";
import chevronDownIcon from "@shared/assets/icons/chevron-down.svg";
import { Alert, Button, Dialog, Select, TextField } from "@shared/ui";

import { useCourseOptions } from "../hooks/useCourseOptions";
import { toCourseFieldError } from "../lib/class-api-errors";
import { CLASS_STATUS_LABEL_KEYS } from "../lib/class-status";
import { canChangeCourse } from "../lib/course-options";
import type { ClassRecord } from "../mocks/classes.mock";
import { classFormSchema, type ClassFormValues } from "../schemas/class-form.schema";
import { CourseSelect } from "./CourseSelect";

export interface ClassFormDialogProps {
  initialClass: ClassRecord;
  isEditing: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /**
   * Saves the class. The dialog stays open until it resolves, and a rejection stays on the form: the
   * refusals about the course (409 `COURSE_CHANGE_NOT_ALLOWED`, 409 `COURSE_ARCHIVED`, 400
   * `COURSE_NOT_FOUND`) go to the course field and anything else to a warning above the buttons.
   */
  onSave: (record: ClassRecord) => void | Promise<void>;
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

function editionName(editionId: string): string {
  return editionId.replace(/-(?=\d+$)/, ".");
}

function getFieldError(message: string | undefined, translate: (key: string) => string) {
  return message ? translate(`form.errors.${message}`) : undefined;
}

export function ClassFormDialog({
  initialClass,
  isEditing,
  onOpenChange,
  onSave,
}: ClassFormDialogProps): ReactElement {
  const { t } = useTranslation("classes");
  const { courses } = useCourseOptions();
  const formId = useId();
  const editionListId = useId();
  const courseFieldRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ClassFormValues>({
    resolver: zodResolver(classFormSchema),
    defaultValues: {
      courseId: initialClass.courseId,
      code: initialClass.code,
      edition: editionName(initialClass.editionId),
      start: initialClass.start,
      end: initialClass.end,
      location: initialClass.location ?? "Laboratório 2 — Bloco B",
      capacity: initialClass.capacity,
      status: initialClass.status,
    },
  });

  const statusOptions = Object.values(ClassStatus).map((status) => ({
    id: status,
    label: t(CLASS_STATUS_LABEL_KEYS[status]),
  }));
  const editions = ["2026.1", "2026.2", "2025.2", "2025.1", "2024"];

  // The course can change only while the class is planned and has no enrollment. What counts is the
  // status the class has SAVED (P11), not the one picked in this form: choosing "Planejada" in an
  // ongoing class does not free the course, and choosing "Em andamento" in a planned one does not
  // lock it before the save. The field is turned off, not left out of the form (`disabled` of the
  // form would drop its value), so the course goes on being sent as it is.
  const isCourseLocked =
    isEditing &&
    !canChangeCourse({ status: initialClass.status, enrolledCount: initialClass.enrolled });
  const serverError = errors.root?.server;

  async function submit(values: ClassFormValues) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      await onSave({
        ...initialClass,
        code: values.code.trim(),
        name: initialClass.name.trim() || values.code.trim(),
        courseId: values.courseId,
        editionId: values.edition.replace(/\.(?=\d+$)/, "-"),
        edition: values.edition,
        start: values.start,
        end: values.end,
        location: values.location.trim(),
        capacity: values.capacity,
        status: values.status,
      });
    } catch (error) {
      const courseError = toCourseFieldError(error);

      if (courseError !== null) {
        setError("courseId", { type: "server", message: courseError });
        // Same as the invalid fields of the other forms: the focus goes to the field that has the error.
        courseFieldRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
      } else {
        setError("root.server", { type: "server", message: "unknown" });
      }
    } finally {
      inFlightRef.current = false;
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit(submit)(event);
  }

  return (
    <Dialog
      isOpen
      onOpenChange={onOpenChange}
      title={isEditing ? t("editTitle") : t("newTitle")}
      closeLabel={t("close")}
      size="wide"
      footer={
        <>
          <Button variant="secondary" onPress={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={formId} isLoading={isSubmitting}>
            {isEditing ? t("saveChanges") : t("saveClass")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        aria-busy={isSubmitting}
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2"
      >
        <Controller
          name="courseId"
          control={control}
          render={({ field, fieldState }) => (
            <div ref={courseFieldRef}>
              <CourseSelect
                label={<RequiredLabel>{t("course")}</RequiredLabel>}
                courses={courses}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                currentCourseId={isEditing ? initialClass.courseId : undefined}
                isDisabled={isCourseLocked}
                description={isCourseLocked ? t("form.courseLockedHint") : undefined}
                isRequired
                autoFocus={!isCourseLocked}
                errorMessage={getFieldError(fieldState.error?.message, t)}
              />
            </div>
          )}
        />
        <div className="hidden sm:block" aria-hidden="true" />

        <Controller
          name="code"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              label={<RequiredLabel>{t("code")}</RequiredLabel>}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              isRequired
              autoFocus={isCourseLocked}
              errorMessage={getFieldError(fieldState.error?.message, t)}
            />
          )}
        />

        <Controller
          name="edition"
          control={control}
          render={({ field, fieldState }) => (
            <>
              <TextField
                label={<RequiredLabel>{t("edition")}</RequiredLabel>}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                list={editionListId}
                placeholder={t("form.editionPlaceholder")}
                endContent={
                  <img src={chevronDownIcon} alt="" aria-hidden="true" width={16} height={16} />
                }
                isRequired
                errorMessage={getFieldError(fieldState.error?.message, t)}
              />
              <datalist id={editionListId}>
                {editions.map((edition) => (
                  <option key={edition} value={edition} />
                ))}
              </datalist>
            </>
          )}
        />

        <Controller
          name="start"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              label={<RequiredLabel>{t("start")}</RequiredLabel>}
              type="date"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              isRequired
              errorMessage={getFieldError(fieldState.error?.message, t)}
            />
          )}
        />

        <Controller
          name="end"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              label={<RequiredLabel>{t("end")}</RequiredLabel>}
              type="date"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              isRequired
              errorMessage={getFieldError(fieldState.error?.message, t)}
            />
          )}
        />

        <Controller
          name="location"
          control={control}
          render={({ field }) => (
            <TextField
              label={t("location")}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
            />
          )}
        />

        <Controller
          name="capacity"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              label={<RequiredLabel>{t("capacity")}</RequiredLabel>}
              value={String(field.value)}
              onChange={(value) => field.onChange(Number(value))}
              onBlur={field.onBlur}
              name={field.name}
              isRequired
              errorMessage={getFieldError(fieldState.error?.message, t)}
            />
          )}
        />

        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select
              label={t("status")}
              options={statusOptions}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
            />
          )}
        />

        {serverError ? (
          <div className="sm:col-span-2">
            <Alert variant="error">{getFieldError(serverError.message, t)}</Alert>
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
