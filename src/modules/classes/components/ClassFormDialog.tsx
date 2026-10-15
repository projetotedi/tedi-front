import { zodResolver } from "@hookform/resolvers/zod";
import { useId, type ReactElement, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import chevronDownIcon from "@shared/assets/icons/chevron-down.svg";
import { Button, Dialog, Select, TextField } from "@shared/ui";

import { mockCourses, type ClassRecord, type ClassStatus } from "../mocks/classes.mock";
import { classFormSchema, type ClassFormValues } from "../schemas/class-form.schema";

export interface ClassFormDialogProps {
  initialClass: ClassRecord;
  isEditing: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (record: ClassRecord) => void;
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
  const formId = useId();
  const editionListId = useId();
  const { control, handleSubmit } = useForm<ClassFormValues>({
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

  const courseOptions = mockCourses.map((course) => ({
    id: course.id,
    label: t(`courses.${course.localeKey}`),
  }));
  const statusOptions: Array<{ id: ClassStatus; label: string }> = [
    { id: "planned", label: t("planned") },
    { id: "inProgress", label: t("inProgress") },
    { id: "completed", label: t("completed") },
    { id: "cancelled", label: t("cancelled") },
  ];
  const editions = ["2026.1", "2026.2", "2025.2", "2025.1", "2024"];

  function submit(values: ClassFormValues) {
    const selectedCourse = mockCourses.find((course) => course.id === values.courseId);
    if (!selectedCourse) return;

    onSave({
      ...initialClass,
      code: values.code.trim(),
      name: initialClass.name.trim() || values.code.trim(),
      courseId: selectedCourse.id,
      course: selectedCourse.name,
      level: selectedCourse.level,
      editionId: values.edition.replace(/\.(?=\d+$)/, "-"),
      edition: values.edition,
      start: values.start,
      end: values.end,
      location: values.location.trim(),
      capacity: values.capacity,
      status: values.status,
    });
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
          <Button type="submit" form={formId}>
            {isEditing ? t("saveChanges") : t("saveClass")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={handleSubmit(submit)}
        className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2"
      >
        <Controller
          name="courseId"
          control={control}
          render={({ field, fieldState }) => (
            <Select
              label={<RequiredLabel>{t("course")}</RequiredLabel>}
              options={courseOptions}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              isRequired
              autoFocus
              errorMessage={getFieldError(fieldState.error?.message, t)}
            />
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
      </form>
    </Dialog>
  );
}
