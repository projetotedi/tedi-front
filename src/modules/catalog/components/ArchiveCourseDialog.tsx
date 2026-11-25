import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useArchiveCourse } from "@api/generated/catalog/catalog";
import { useGetClassesSummaryByCourse } from "@api/generated/classes/classes";
import type { CourseDetailDto, CourseResponseDto } from "@api/generated/model";
import { Alert, Button, Dialog, TextArea, toast } from "@shared/ui";

import { resolveArchiveField, toSubmitError, type SubmitErrorKind } from "../lib/api-form-errors";
import { isCourseNotFound } from "../lib/course-detail";
import { invalidateAfterCourseArchiveChanged } from "../lib/course-queries";
import {
  ARCHIVE_COURSE_LIMITS,
  archiveCourseFormSchema,
  toArchiveCourseBody,
  type ArchiveCourseFormValues,
} from "../schemas/archive-course.schema";

export interface ArchiveCourseDialogProps {
  course: Pick<CourseDetailDto, "id" | "name">;
  onClose: () => void;
  onArchived?: (course: CourseResponseDto) => void;
}

/**
 * Arquivar curso (RN-27, RF-020, GUS-139), as in the Figma: the warning that an archived course
 * takes no new class, how many classes it already has (they stay as they are), an optional reason
 * and Voltar / Arquivar curso. The reason goes to the API only when it was filled in.
 *
 * The number of classes comes from `getClassesSummaryByCourse` (GUS-102), the generated hook of the
 * classes routes. While it loads, or when it fails, the text is shown without the number: the
 * archive does not depend on it.
 *
 * Opened from the header of the course and, with GUS-131, from the bin of the list of courses: it
 * knows nothing of where it was opened from, and closes itself after the archive.
 */
export function ArchiveCourseDialog({
  course,
  onClose,
  onArchived,
}: ArchiveCourseDialogProps): ReactElement {
  const { t } = useTranslation("catalog");
  const queryClient = useQueryClient();
  const formId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const [submitError, setSubmitError] = useState<SubmitErrorKind | null>(null);

  const summaryQuery = useGetClassesSummaryByCourse({ courseIds: course.id });
  const classCount = summaryQuery.data?.find((summary) => summary.courseId === course.id)?.total;

  const { control, handleSubmit, setError, setFocus } = useForm<ArchiveCourseFormValues>({
    resolver: zodResolver(archiveCourseFormSchema),
    defaultValues: { reason: "" },
  });

  const archiveCourse = useArchiveCourse();
  const isPending = archiveCourse.isPending;

  useEffect(() => {
    if (submitError !== null) errorRef.current?.focus();
  }, [submitError]);

  function handleError(error: unknown) {
    if (isCourseNotFound(error)) {
      setSubmitError("notFound");
      return;
    }
    const result = toSubmitError(error, resolveArchiveField);

    if (result.kind === "fields") {
      for (const { name, message } of result.fields) setError(name, { type: "server", message });
      setFocus(result.fields[0].name);
      return;
    }
    setSubmitError(result.kind);
  }

  function archive(values: ArchiveCourseFormValues) {
    if (isPending || inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitError(null);

    archiveCourse.mutate(
      { id: course.id, data: toArchiveCourseBody(values) },
      {
        onSuccess: (archived) => {
          toast.success(t("course.archive.success"));
          void invalidateAfterCourseArchiveChanged(queryClient, archived);
          onArchived?.(archived);
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
    void handleSubmit(archive)(event);
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("course.archive.title")}
      closeLabel={t("close")}
      isDismissable={!isPending}
      footer={
        <>
          <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
            {t("course.archive.back")}
          </Button>
          <Button variant="danger-soft" type="submit" form={formId} isLoading={isPending}>
            {isPending ? t("course.archive.confirming") : t("course.archive.confirm")}
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
        <Alert
          variant="warning"
          description={
            classCount === undefined
              ? t("course.archive.keepsClassesNoCount")
              : t("course.archive.keepsClasses", { count: classCount })
          }
        >
          {t("course.archive.warningTitle")}
        </Alert>

        <Controller
          name="reason"
          control={control}
          render={({ field, fieldState }) => (
            <TextArea
              label={t("course.archive.reason")}
              description={t("course.archive.reasonHelp")}
              placeholder={t("course.archive.reasonExample")}
              rows={4}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              autoFocus
              errorMessage={
                fieldState.error?.message
                  ? t(`course.archive.errors.${fieldState.error.message}`, ARCHIVE_COURSE_LIMITS)
                  : undefined
              }
            />
          )}
        />

        {submitError !== null ? (
          <div ref={errorRef} tabIndex={-1} className="outline-none">
            <Alert variant="error">{t(`course.actionErrors.${submitError}`)}</Alert>
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
