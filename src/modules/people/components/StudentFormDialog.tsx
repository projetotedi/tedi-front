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
import { Controller, useForm, useWatch, type Control } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { AccessibilityNeed, type StudentDetailDto } from "@api/generated/model";
import { useCreateStudent, useGetStudent, useUpdateStudent } from "@api/generated/people/people";
import { useMediaQuery } from "@shared/hooks/useMediaQuery";
import {
  Alert,
  Button,
  DatePicker,
  Dialog,
  RadioGroup,
  Select,
  Skeleton,
  TextArea,
  TextField,
  toast,
} from "@shared/ui";

import { maskPhone } from "../lib/format";
import { ageOn, isValidBirthDate } from "../lib/student";
import { toStudentActionError, type StudentActionErrorKind } from "../lib/student-errors";
import { invalidateAfterStudentChanged } from "../lib/student-queries";
import {
  STUDENT_LIMITS,
  emptyStudentFormValues,
  studentFormSchema,
  toCreateStudentBody,
  toStudentFormValues,
  toUpdateStudentBody,
  type StudentFormValues,
} from "../schemas/student.schema";
import { RequiredLabel } from "./RequiredLabel";

/** The phone of the Figma: below 768px the form takes the whole screen, in one column. */
const MOBILE_QUERY = "(max-width: 47.99rem)";

/** The suggestions of Escolaridade; the field takes any text, as the API does. */
const EDUCATION_LEVELS = [
  "elementaryIncomplete",
  "elementaryComplete",
  "highSchoolIncomplete",
  "highSchoolComplete",
  "higherIncomplete",
  "higherComplete",
] as const;

export type StudentFormDialogProps = {
  onClose: () => void;
  onSaved?: () => void;
} & ({ mode: "create" } | { mode: "edit"; studentId: string });

/** A group of the form. The title shows on the phone, as in the Figma; on the desktop only the screen reader reads it. */
function Section({
  title,
  isMobile,
  children,
}: {
  title: string;
  isMobile: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    <fieldset className="flex min-w-0 flex-col gap-4">
      <legend className={isMobile ? "mb-2 text-lg font-semibold" : "sr-only"}>{title}</legend>
      {children}
    </fieldset>
  );
}

function YesNoField({
  control,
  name,
  label,
  isMobile,
}: {
  control: Control<StudentFormValues>;
  name: "hasSmartphone" | "hasComputer";
  label: string;
  isMobile: boolean;
}): ReactElement {
  const { t } = useTranslation("people");

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) =>
        isMobile ? (
          <RadioGroup
            label={label}
            orientation="horizontal"
            value={field.value === "" ? null : field.value}
            onChange={field.onChange}
            name={field.name}
            options={[
              { value: "yes", label: t("student.yes") },
              { value: "no", label: t("student.no") },
            ]}
          />
        ) : (
          <Select
            label={label}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            triggerRef={field.ref}
            options={[
              { id: "", label: t("student.form.notInformed") },
              { id: "yes", label: t("student.yes") },
              { id: "no", label: t("student.no") },
            ]}
          />
        )
      }
    />
  );
}

/** "67 anos" beside the birth date, while the date is valid. */
function useAgeHint(control: Control<StudentFormValues>): string | undefined {
  const { t } = useTranslation("people");
  const birthDate = useWatch({ control, name: "birthDate" });
  return isValidBirthDate(birthDate)
    ? t("student.form.ageHint", { count: ageOn(birthDate) })
    : undefined;
}

interface StudentFormProps {
  formId: string;
  student: StudentDetailDto | null;
  isMobile: boolean;
  onPendingChange: (isPending: boolean) => void;
  onSaved: () => void;
}

function StudentForm({
  formId,
  student,
  isMobile,
  onPendingChange,
  onSaved,
}: StudentFormProps): ReactElement {
  const { t } = useTranslation("people");
  const queryClient = useQueryClient();
  const errorRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const educationListId = useId();
  const [submitError, setSubmitError] = useState<StudentActionErrorKind | null>(null);
  const initialValues = useMemo(
    () => (student ? toStudentFormValues(student) : emptyStudentFormValues()),
    [student],
  );

  const { control, handleSubmit, setError, setFocus } = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: initialValues,
  });
  const ageHint = useAgeHint(control);

  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();
  const isPending = createStudent.isPending || updateStudent.isPending;

  useEffect(() => onPendingChange(isPending), [isPending, onPendingChange]);
  useEffect(() => {
    if (submitError !== null) errorRef.current?.focus();
  }, [submitError]);

  function handleError(error: unknown) {
    const result = toStudentActionError(error);
    if (result.kind === "fields") {
      const fields = result.fields.filter(
        (field): field is { name: keyof StudentFormValues; message: string } =>
          field.name !== "reason",
      );
      if (fields.length === 0) {
        setSubmitError("unknown");
        return;
      }
      for (const { name, message } of fields) setError(name, { type: "server", message });
      setFocus(fields[0].name);
      return;
    }
    setSubmitError(result.kind);
  }

  function afterSave(messageKey: "student.form.created" | "student.form.updated") {
    toast.success(t(messageKey));
    void invalidateAfterStudentChanged(queryClient);
    onSaved();
  }

  function save(values: StudentFormValues) {
    if (isPending || inFlightRef.current) return;
    setSubmitError(null);
    const settle = { onSettled: () => (inFlightRef.current = false), onError: handleError };

    if (student === null) {
      inFlightRef.current = true;
      createStudent.mutate(
        { data: toCreateStudentBody(values) },
        { ...settle, onSuccess: () => afterSave("student.form.created") },
      );
      return;
    }

    const body = toUpdateStudentBody(values, initialValues);
    if (Object.keys(body).length === 0) {
      onSaved();
      return;
    }
    inFlightRef.current = true;
    updateStudent.mutate(
      { id: student.id, data: body },
      { ...settle, onSuccess: () => afterSave("student.form.updated") },
    );
  }

  const errorText = (message: string | undefined) =>
    message ? t(`student.form.errors.${message}`, STUDENT_LIMITS) : undefined;
  const pair = isMobile ? "flex flex-col gap-4" : "grid grid-cols-2 gap-4";

  const phoneField = (name: "phone" | "emergencyContactPhone", label: string) => (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <TextField
          label={label}
          value={field.value}
          onChange={(value) => field.onChange(maskPhone(value))}
          onBlur={field.onBlur}
          name={field.name}
          inputRef={field.ref}
          inputMode="tel"
          autoComplete={name === "phone" ? "tel" : "off"}
          placeholder={t("student.form.phonePlaceholder")}
          errorMessage={errorText(fieldState.error?.message)}
        />
      )}
    />
  );

  const textField = (
    name: "howFoundUs" | "emergencyContactName" | "supportResource",
    label: string,
  ) => (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <TextField
          label={label}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          name={field.name}
          inputRef={field.ref}
          errorMessage={errorText(fieldState.error?.message)}
        />
      )}
    />
  );

  return (
    <form
      id={formId}
      noValidate
      aria-busy={isPending}
      onSubmit={(event) => void handleSubmit(save)(event)}
      className="flex flex-col gap-6"
    >
      <Section title={t("student.form.sections.personal")} isMobile={isMobile}>
        <Controller
          name="name"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              label={<RequiredLabel>{t("student.personal.fullName")}</RequiredLabel>}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              autoComplete="off"
              isRequired
              autoFocus={!isMobile}
              errorMessage={errorText(fieldState.error?.message)}
            />
          )}
        />
        <div className={pair}>
          <Controller
            name="birthDate"
            control={control}
            render={({ field, fieldState }) => (
              <DatePicker
                label={<RequiredLabel>{t("student.personal.birthDate")}</RequiredLabel>}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                isRequired
                description={ageHint}
                errorMessage={errorText(fieldState.error?.message)}
              />
            )}
          />
          {phoneField("phone", t("student.personal.phone"))}
        </div>
        <div className={pair}>
          <Controller
            name="email"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                label={t("student.personal.email")}
                type="email"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                autoComplete="off"
                errorMessage={errorText(fieldState.error?.message)}
              />
            )}
          />
          {isMobile ? null : (
            <Controller
              name="education"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  label={t("student.personal.education")}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  inputRef={field.ref}
                  list={educationListId}
                  errorMessage={errorText(fieldState.error?.message)}
                />
              )}
            />
          )}
        </div>
      </Section>

      <Section title={t("student.form.sections.technology")} isMobile={isMobile}>
        {isMobile ? (
          <Controller
            name="education"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                label={t("student.personal.education")}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                list={educationListId}
                errorMessage={errorText(fieldState.error?.message)}
              />
            )}
          />
        ) : null}
        <datalist id={educationListId}>
          {EDUCATION_LEVELS.map((level) => (
            <option key={level} value={t(`student.form.educationLevels.${level}`)} />
          ))}
        </datalist>
        <div className={pair}>
          <YesNoField
            control={control}
            name="hasSmartphone"
            label={t("student.personal.hasSmartphone")}
            isMobile={isMobile}
          />
          <YesNoField
            control={control}
            name="hasComputer"
            label={t("student.personal.hasComputer")}
            isMobile={isMobile}
          />
        </div>
        {textField("howFoundUs", t("student.personal.howFoundUs"))}
      </Section>

      <Section title={t("student.form.sections.emergency")} isMobile={isMobile}>
        <div className={pair}>
          {textField("emergencyContactName", t("student.personal.emergencyContactName"))}
          {phoneField("emergencyContactPhone", t("student.personal.emergencyContactPhone"))}
        </div>
      </Section>

      <Section title={t("student.form.sections.accessibility")} isMobile={isMobile}>
        <div className={pair}>
          <Controller
            name="accessibilityNeed"
            control={control}
            render={({ field }) => (
              <Select
                label={t("student.form.accessibilityNeed")}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                triggerRef={field.ref}
                options={Object.values(AccessibilityNeed).map((need) => ({
                  id: need,
                  label: t(`student.accessibilityNeed.${need}`),
                }))}
              />
            )}
          />
          {textField("supportResource", t("student.accessibility.columns.supportResource"))}
        </div>
        <Controller
          name="classNeeds"
          control={control}
          render={({ field, fieldState }) => (
            <TextArea
              label={t("student.form.classNeeds")}
              description={t("student.form.noDiagnosisHint")}
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
      </Section>

      {submitError !== null ? (
        <div ref={errorRef} tabIndex={-1} className="outline-none">
          <Alert variant="error">{t(`student.actionErrors.${submitError}`)}</Alert>
        </div>
      ) : null}
    </form>
  );
}

function LoadingPlaceholder({ label }: { label: string }): ReactElement {
  return (
    <div role="status" className="flex flex-col gap-4">
      <p className="sr-only">{label}</p>
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

/**
 * Editar dados loads the student first: the row of the list does not bring the whole registration.
 * `gcTime: 0` as on the record: it holds health data (LGPD) and leaves the cache when the dialog
 * closes.
 */
function EditStudentForm({
  studentId,
  ...props
}: Omit<StudentFormProps, "student"> & { studentId: string }): ReactElement {
  const { t } = useTranslation("people");
  const query = useGetStudent(studentId, { query: { gcTime: 0 } });

  if (query.isPending) return <LoadingPlaceholder label={t("student.form.loading")} />;
  if (query.data === undefined) return <Alert variant="error">{t("student.form.loadError")}</Alert>;
  if (query.data.archivedAt !== null) {
    return <Alert variant="warning">{t("student.actionErrors.archived")}</Alert>;
  }
  return <StudentForm student={query.data} {...props} />;
}

/**
 * Novo aluno and Editar dados do aluno (GUS-123, Figma): Dados pessoais, Escolaridade and the use
 * of technology, Contato de emergência and Acessibilidade, with the hint to write what the person
 * needs in class and never a diagnosis (RNF-13). Only the name and the birth date are required; the
 * age shows beside the date. On the phone the form takes the whole screen, in one column, with
 * titled groups and Salvar aluno fixed at the bottom.
 *
 * Opened by + Novo aluno and the pencil of the list and by Editar dados on the record; it knows
 * nothing of where it was opened from and closes itself after the save, so the person stays where
 * they were. Nothing of the student goes to the title of the page or to the console.
 */
export function StudentFormDialog(props: StudentFormDialogProps): ReactElement {
  const { t } = useTranslation("people");
  const formId = useId();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [isPending, setIsPending] = useState(false);
  const { onClose, onSaved } = props;
  const isEdit = props.mode === "edit";

  const formProps = {
    formId,
    isMobile,
    onPendingChange: setIsPending,
    onSaved: () => {
      onSaved?.();
      onClose();
    },
  };

  const saveLabel = isPending
    ? t("student.form.saving")
    : isEdit
      ? t("student.form.saveChanges")
      : t("student.form.save");

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={isEdit ? t("student.form.editTitle") : t("student.form.newTitle")}
      closeLabel={t("student.form.close")}
      size={isMobile ? "fullscreen" : "wide"}
      isDismissable={!isPending}
      footer={
        isMobile ? (
          <Button type="submit" form={formId} isLoading={isPending} className="min-h-11 w-full">
            {saveLabel}
          </Button>
        ) : (
          <>
            <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
              {t("student.form.cancel")}
            </Button>
            <Button type="submit" form={formId} isLoading={isPending}>
              {saveLabel}
            </Button>
          </>
        )
      }
    >
      {props.mode === "edit" ? (
        <EditStudentForm studentId={props.studentId} {...formProps} />
      ) : (
        <StudentForm student={null} {...formProps} />
      )}
    </Dialog>
  );
}
