import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";

import {
  useCreateCourse,
  useGetCourse,
  useListCourses,
  useUpdateCourse,
} from "@api/generated/catalog/catalog";
import {
  CourseCategory,
  CourseListSort,
  CourseStatus,
  type CourseDetailDto,
  type CourseResponseDto,
} from "@api/generated/model";
import {
  Alert,
  Button,
  Dialog,
  MultiSelect,
  Select,
  Skeleton,
  TextArea,
  TextField,
  toast,
  type SelectOption,
} from "@shared/ui";

import type { SubmitErrorKind } from "../lib/api-form-errors";
import { toCourseFormError } from "../lib/course-errors";
import { invalidateAfterCourseSaved } from "../lib/course-queries";
import {
  COURSE_LIMITS,
  courseFormSchema,
  emptyCourseFormValues,
  toCourseFormValues,
  toCreateCourseBody,
  toUpdateCourseBody,
  type CourseFormValues,
} from "../schemas/course.schema";

/** The prerequisites offered: the active courses, one page of the biggest size the API gives. */
const PREREQUISITE_OPTIONS_LIMIT = 100;

interface DialogCallbacks {
  onClose: () => void;
  onSaved?: (course: CourseResponseDto) => void;
  /** Editar curso was refused with 409 `COURSE_ARCHIVED`: the course was archived meanwhile. */
  onCourseArchived?: () => void;
}

export type CourseFormDialogProps =
  | (DialogCallbacks & { mode: "create" })
  | (DialogCallbacks & { mode: "edit"; courseId: string });

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
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

/**
 * The options of Pré-requisitos: the active courses (RF-020: an archived course is not offered),
 * never the course being edited. A prerequisite the course already has stays chosen even if it was
 * archived since (the API keeps a link that exists), and is named "(arquivado)" so the person knows.
 */
function usePrerequisiteOptions(course: CourseDetailDto | null): {
  options: SelectOption[];
  isPending: boolean;
  isError: boolean;
} {
  const { t } = useTranslation("catalog");
  const query = useListCourses({
    status: CourseStatus.active,
    limit: PREREQUISITE_OPTIONS_LIMIT,
    sort: CourseListSort.name,
  });

  const options = useMemo(() => {
    const active = (query.data?.data ?? [])
      .filter((item) => item.id !== course?.id)
      .map((item) => ({ id: item.id, label: item.name }));
    const offered = new Set(active.map((option) => option.id));
    const kept = (course?.prerequisites ?? [])
      .filter((prerequisite) => !offered.has(prerequisite.id))
      .map((prerequisite) => ({
        id: prerequisite.id,
        label:
          prerequisite.status === CourseStatus.archived
            ? t("course.form.archivedPrerequisite", { name: prerequisite.name })
            : prerequisite.name,
      }));
    return [...active, ...kept];
  }, [query.data, course, t]);

  return { options, isPending: query.isPending, isError: query.isError };
}

interface CourseFormProps {
  formId: string;
  course: CourseDetailDto | null;
  onPendingChange: (isPending: boolean) => void;
  onSaved: (course: CourseResponseDto) => void;
  onCourseArchived?: () => void;
}

function CourseForm({
  formId,
  course,
  onPendingChange,
  onSaved,
  onCourseArchived,
}: CourseFormProps): ReactElement {
  const { t } = useTranslation("catalog");
  const queryClient = useQueryClient();
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const [submitError, setSubmitError] = useState<SubmitErrorKind | null>(null);
  const initialValues = useMemo(
    () => (course ? toCourseFormValues(course) : emptyCourseFormValues()),
    [course],
  );
  const prerequisites = usePrerequisiteOptions(course);

  const { control, handleSubmit, setError, setFocus } = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: initialValues,
  });
  const category = useWatch({ control, name: "category" });
  const categoryChanged = course !== null && category !== "" && category !== course.category;

  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();
  const isPending = createCourse.isPending || updateCourse.isPending;

  useEffect(() => onPendingChange(isPending), [isPending, onPendingChange]);
  useEffect(() => {
    if (submitError !== null) errorRef.current?.focus();
  }, [submitError]);

  function handleError(error: unknown) {
    const result = toCourseFormError(error);

    if (result.kind === "fields") {
      for (const { name, message } of result.fields) setError(name, { type: "server", message });
      setFocus(result.fields[0].name);
      return;
    }
    if (result.kind === "archived") onCourseArchived?.();
    setSubmitError(result.kind);
  }

  function afterSave(saved: CourseResponseDto, messageKey: string) {
    toast.success(t(messageKey));
    void invalidateAfterCourseSaved(queryClient);
    onSaved(saved);
  }

  function save(values: CourseFormValues) {
    if (isPending || inFlightRef.current) return;
    setSubmitError(null);
    const settle = { onSettled: () => (inFlightRef.current = false), onError: handleError };

    if (course === null) {
      inFlightRef.current = true;
      createCourse.mutate(
        { data: toCreateCourseBody(values) },
        { ...settle, onSuccess: (saved) => afterSave(saved, "course.form.created") },
      );
      return;
    }

    const body = toUpdateCourseBody(values, initialValues);
    if (Object.keys(body).length === 0) {
      // Nothing changed: no request, and the dialog closes as after a save.
      onSaved({ id: course.id } as CourseResponseDto);
      return;
    }
    inFlightRef.current = true;
    updateCourse.mutate(
      { id: course.id, data: body },
      { ...settle, onSuccess: (saved) => afterSave(saved, "course.form.updated") },
    );
  }

  const errorText = (message: string | undefined) =>
    message ? t(`course.form.errors.${message}`, COURSE_LIMITS) : undefined;

  const categoryOptions: SelectOption[] = Object.values(CourseCategory).map((value) => ({
    id: value,
    label: t(`category.${value}`),
  }));

  return (
    <form
      id={formId}
      noValidate
      aria-busy={isPending}
      onSubmit={(event) => void handleSubmit(save)(event)}
      className="flex flex-col gap-4"
    >
      <Controller
        name="name"
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            label={<RequiredLabel>{t("course.form.name")}</RequiredLabel>}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Controller
          name="category"
          control={control}
          render={({ field, fieldState }) => (
            <Select
              label={<RequiredLabel>{t("course.form.category")}</RequiredLabel>}
              options={categoryOptions}
              value={field.value === "" ? null : field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              placeholder={t("course.form.categoryPlaceholder")}
              isRequired
              errorMessage={errorText(fieldState.error?.message)}
            />
          )}
        />
        <Controller
          name="prerequisiteIds"
          control={control}
          render={({ field, fieldState }) => (
            <MultiSelect
              label={t("course.form.prerequisites")}
              options={prerequisites.options}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              triggerRef={field.ref}
              placeholder={
                prerequisites.isPending
                  ? t("course.form.prerequisitesLoading")
                  : t("course.form.prerequisitesPlaceholder")
              }
              description={
                prerequisites.isError ? t("course.form.prerequisitesLoadError") : undefined
              }
              errorMessage={errorText(fieldState.error?.message)}
            />
          )}
        />
      </div>

      {categoryChanged ? (
        <Alert variant="info" description={t("course.form.categoryChangedDescription")}>
          {t("course.form.categoryChangedTitle")}
        </Alert>
      ) : null}

      <Controller
        name="description"
        control={control}
        render={({ field, fieldState }) => (
          <TextArea
            label={<RequiredLabel>{t("course.form.description")}</RequiredLabel>}
            rows={3}
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
      <Controller
        name="objective"
        control={control}
        render={({ field, fieldState }) => (
          <TextArea
            label={t("course.form.objective")}
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

      {submitError !== null ? (
        <div ref={errorRef} tabIndex={-1} className="outline-none">
          <Alert variant="error">{t(`course.actionErrors.${submitError}`)}</Alert>
        </div>
      ) : null}
    </form>
  );
}

/** Editar curso loads the course first: the row of the list does not bring the whole form. */
function EditCourseForm({
  courseId,
  ...props
}: Omit<CourseFormProps, "course"> & { courseId: string }): ReactElement {
  const { t } = useTranslation("catalog");
  const query = useGetCourse(courseId);

  if (query.isPending) return <LoadingPlaceholder label={t("course.form.loading")} />;
  if (query.data === undefined) {
    return <Alert variant="error">{t("course.form.loadError")}</Alert>;
  }
  return <CourseForm course={query.data} {...props} />;
}

/**
 * Novo curso and Editar curso (RF-013, RF-021, GUS-129), as in the Figma: Nome do curso, Categoria
 * and Pré-requisitos side by side, Descrição and Objetivo; Cancelar and Salvar curso (or Salvar
 * alterações). Opened from the list (+ Novo curso, the pencil of a row) and from the detail
 * (Editar curso); it knows nothing of where it was opened from and closes itself after the save,
 * so the person stays where they were.
 *
 * The name taken (409) shows on the name and the problems with the prerequisites (a cycle, a
 * course that does not exist or was archived) on Pré-requisitos, with the focus there. When the
 * category changes in Editar curso, a note says that the classes of the course show the new one
 * (RN-14: a class has no category of its own).
 */
export function CourseFormDialog(props: CourseFormDialogProps): ReactElement {
  const { t } = useTranslation("catalog");
  const formId = useId();
  const [isPending, setIsPending] = useState(false);
  const { onClose, onSaved, onCourseArchived } = props;
  const isEdit = props.mode === "edit";

  const formProps = {
    formId,
    onPendingChange: setIsPending,
    onSaved: (saved: CourseResponseDto) => {
      onSaved?.(saved);
      onClose();
    },
    onCourseArchived,
  };

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={isEdit ? t("course.form.editTitle") : t("course.form.newTitle")}
      closeLabel={t("close")}
      size="wide"
      isDismissable={!isPending}
      footer={
        <>
          <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
            {t("course.form.cancel")}
          </Button>
          <Button type="submit" form={formId} isLoading={isPending}>
            {isPending
              ? t("course.form.saving")
              : isEdit
                ? t("course.form.saveChanges")
                : t("course.form.save")}
          </Button>
        </>
      }
    >
      {props.mode === "edit" ? (
        <EditCourseForm courseId={props.courseId} {...formProps} />
      ) : (
        <CourseForm course={null} {...formProps} />
      )}
    </Dialog>
  );
}
