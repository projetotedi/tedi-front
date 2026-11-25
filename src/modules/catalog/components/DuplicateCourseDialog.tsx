import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useDuplicateCourse } from "@api/generated/catalog/catalog";
import type { CourseDetailDto } from "@api/generated/model";
import { Alert, Button, Dialog, TextField, toast } from "@shared/ui";

import { invalidateAfterCourseDuplicated } from "../lib/course-queries";
import {
  isDuplicateCourseFieldError,
  toDuplicateCourseErrorKind,
  type DuplicateCourseErrorKind,
  type DuplicateCourseFieldError,
} from "../lib/duplicate-course-errors";
import {
  DUPLICATE_COURSE_LIMITS,
  duplicateCourseFormSchema,
  toDuplicateCourseBody,
  type DuplicateCourseFormValues,
} from "../schemas/duplicate-course.schema";

export interface DuplicateCourseDialogProps {
  /** What the dialog needs of the course on the screen: the id to copy, the name to suggest and how many plans come along. */
  course: Pick<CourseDetailDto, "id" | "name" | "lessonPlanCount">;
  onClose: () => void;
}

/** The errors that have no field to point at: they show as an alert inside the dialog. */
type AlertErrorKind = Exclude<DuplicateCourseErrorKind, DuplicateCourseFieldError>;

/**
 * "Duplicar curso" (RF-019): the name of the new course, filled with "<name> (cópia)", and what
 * is copied with it. Duplicar curso sends `POST /courses/:id/duplicate`; on success the toast says
 * so and the screen goes, by push, to the detail of the copy, so Voltar of the browser leads back
 * to the original. The copy is born active, with the plans and the order of the original, and
 * without prerequisites and classes.
 *
 * The name has to be unique among all courses, archived ones included, and only the API can tell:
 * its 409 `COURSE_NAME_TAKEN` (and a 400 that points at `name`) is written on the name field, with
 * the focus there and the dialog open, so the person changes the name and tries again. The errors
 * without a field (the course is gone, no connection, anything else) show as an alert inside the
 * dialog, which takes the focus, and the next try clears it.
 *
 * While the request is on its way the dialog cannot be closed (the close button, Escape and Voltar
 * are off) and a second press of Duplicar curso is ignored: the answer decides where the person
 * goes, and a second `POST` would try to create the same course twice.
 */
export function DuplicateCourseDialog({
  course,
  onClose,
}: DuplicateCourseDialogProps): ReactElement {
  const { t } = useTranslation("catalog");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const formId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const [submitError, setSubmitError] = useState<AlertErrorKind | null>(null);

  const { control, handleSubmit, setError, setFocus } = useForm<DuplicateCourseFormValues>({
    resolver: zodResolver(duplicateCourseFormSchema),
    // The suffix comes from i18n and the card wins over the Figma, which suggests "(2026.2)". A
    // name that is already 200 characters long is not cut: the suggestion would be refused, and the
    // field says so on Duplicar curso, so the person shortens it.
    defaultValues: { name: t("course.duplicate.suggestedName", { name: course.name }) },
  });

  // The cache is told even if the person has left the screen by the time the answer arrives. The
  // toast and the navigation are not: they go in the callbacks of `mutate` below, which do not run
  // once the dialog is gone, so a copy that arrives late never pulls the person away from where
  // they went.
  const duplicateCourse = useDuplicateCourse({
    mutation: { onSuccess: () => void invalidateAfterCourseDuplicated(queryClient) },
  });
  const isPending = duplicateCourse.isPending;

  useEffect(() => {
    if (submitError !== null) errorRef.current?.focus();
  }, [submitError]);

  function handleError(error: unknown) {
    const kind = toDuplicateCourseErrorKind(error);

    if (isDuplicateCourseFieldError(kind)) {
      setError("name", { type: "server", message: kind });
      setFocus("name");
      return;
    }
    setSubmitError(kind);
  }

  function duplicate(values: DuplicateCourseFormValues) {
    if (isPending || inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitError(null);

    duplicateCourse.mutate(
      { id: course.id, data: toDuplicateCourseBody(values) },
      {
        onSuccess: (copy) => {
          toast.success(t("course.duplicate.success"));
          navigate(`/courses/${copy.id}`);
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
    void handleSubmit(duplicate)(event);
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("course.duplicate.title")}
      closeLabel={t("close")}
      isDismissable={!isPending}
      footer={
        <>
          <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
            {t("course.duplicate.back")}
          </Button>
          <Button variant="primary" type="submit" form={formId} isLoading={isPending}>
            {isPending ? t("course.duplicate.submitting") : t("course.duplicate.submit")}
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
          name="name"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              label={t("course.duplicate.nameLabel")}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              autoComplete="off"
              isRequired
              autoFocus
              errorMessage={
                fieldState.error?.message
                  ? t(
                      `course.duplicate.fieldErrors.${fieldState.error.message}`,
                      DUPLICATE_COURSE_LIMITS,
                    )
                  : undefined
              }
            />
          )}
        />

        <Alert
          variant="info"
          description={t("course.duplicate.copiedDescription", { count: course.lessonPlanCount })}
        >
          {t("course.duplicate.copiedTitle")}
        </Alert>

        {submitError !== null ? (
          <div ref={errorRef} tabIndex={-1} className="outline-none">
            <Alert variant="error">{t(`course.duplicate.errors.${submitError}`)}</Alert>
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
