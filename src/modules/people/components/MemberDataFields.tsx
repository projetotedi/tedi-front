import type { ReactElement, ReactNode } from "react";
import { Controller, type Control } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { BrazilianState, type DepartmentResponseDto } from "@api/generated/model";
import { formatCpf } from "@modules/auth";
import { Alert, Button, DatePicker, Select, TextField } from "@shared/ui";

import { maskPhone } from "../lib/format";
import {
  MEMBER_LIMITS,
  type MemberFormFieldName,
  type MemberFormValues,
} from "../schemas/member.schema";
import { RequiredLabel } from "./RequiredLabel";

/** The option that clears the state: the API takes `null` for it. */
const NO_STATE = "none";
const STATES = Object.values(BrazilianState).sort();

export interface MemberDataFieldsProps {
  control: Control<MemberFormValues>;
  /** The masked CPF of the record, shown as a hint: the form never knows the whole one (RNF-14). */
  cpfMasked: string | null;
  /** The department of the member, listed even when `GET /departments` does not bring it. */
  currentDepartment: DepartmentResponseDto | null;
  /** The departments to choose from; only who edits any member (`all`) changes the department. */
  departments: DepartmentResponseDto[];
  canChangeDepartment: boolean;
  isDepartmentsLoading: boolean;
  isDepartmentsError: boolean;
  onRetryDepartments: () => void;
}

/** The wrapper the dialog finds a field by, to give the focus to the first one with an error. */
function Field({
  name,
  wide = false,
  children,
}: {
  name: MemberFormFieldName;
  wide?: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    <div data-field={name} className={wide ? "sm:col-span-2" : undefined}>
      {children}
    </div>
  );
}

/**
 * The fields of Editar membro, in two groups: Informações pessoais and Dados acadêmicos e
 * institucionais, as the registration by invite asks them. Every field the API never clears has the
 * asterisk; the CPF is only typed to change it.
 */
export function MemberDataFields({
  control,
  cpfMasked,
  currentDepartment,
  departments,
  canChangeDepartment,
  isDepartmentsLoading,
  isDepartmentsError,
  onRetryDepartments,
}: MemberDataFieldsProps): ReactElement {
  const { t } = useTranslation("people");

  const errorText = (message: string | undefined) =>
    message ? t(`member.edit.errors.${message}`, MEMBER_LIMITS) : undefined;

  const stateOptions = [
    { id: NO_STATE, label: t("member.edit.fields.noState") },
    ...STATES.map((state) => ({ id: state, label: state })),
  ];
  const departmentOptions = departments.map(({ id, name }) => ({ id, label: name }));
  if (currentDepartment && !departments.some(({ id }) => id === currentDepartment.id)) {
    departmentOptions.push({ id: currentDepartment.id, label: currentDepartment.name });
  }

  const textField = (
    name: Exclude<MemberFormFieldName, "birthDate" | "joinedAt" | "state" | "departmentId">,
    label: ReactNode,
    extra: {
      type?: "email";
      inputMode?: "numeric" | "tel" | "url";
      autoComplete?: string;
      description?: string;
      placeholder?: string;
      isRequired?: boolean;
      format?: (value: string) => string;
    } = {},
  ) => (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <TextField
          label={extra.isRequired ? <RequiredLabel>{label}</RequiredLabel> : label}
          type={extra.type}
          value={field.value}
          onChange={(value) => field.onChange(extra.format ? extra.format(value) : value)}
          onBlur={field.onBlur}
          name={field.name}
          inputRef={field.ref}
          inputMode={extra.inputMode}
          autoComplete={extra.autoComplete ?? "off"}
          description={extra.description}
          placeholder={extra.placeholder}
          isRequired={extra.isRequired}
          errorMessage={errorText(fieldState.error?.message)}
        />
      )}
    />
  );

  const dateField = (name: "birthDate" | "joinedAt", label: string) => (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <DatePicker
          label={<RequiredLabel>{label}</RequiredLabel>}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          name={field.name}
          isRequired
          errorMessage={errorText(fieldState.error?.message)}
        />
      )}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex min-w-0 flex-col gap-4">
        <legend className="mb-2 text-base font-semibold text-foreground">
          {t("member.edit.sections.personal")}
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field name="name" wide>
            {textField("name", t("member.edit.fields.name"), {
              autoComplete: "name",
              isRequired: true,
            })}
          </Field>
          <Field name="birthDate">
            {dateField("birthDate", t("member.edit.fields.birthDate"))}
          </Field>
          <Field name="phone">
            {textField("phone", t("member.edit.fields.phone"), {
              inputMode: "tel",
              autoComplete: "tel",
              placeholder: t("member.edit.fields.phonePlaceholder"),
              isRequired: true,
              format: maskPhone,
            })}
          </Field>
          <Field name="email">
            {textField("email", t("member.edit.fields.email"), {
              type: "email",
              autoComplete: "email",
              isRequired: true,
            })}
          </Field>
          <Field name="cpf">
            {textField("cpf", t("member.edit.fields.cpf"), {
              inputMode: "numeric",
              placeholder: t("member.edit.fields.cpfPlaceholder"),
              description: cpfMasked
                ? t("member.edit.fields.cpfHintMasked", { cpf: cpfMasked })
                : t("member.edit.fields.cpfHint"),
              format: formatCpf,
            })}
          </Field>
          <Field name="address" wide>
            {textField("address", t("member.edit.fields.address"), {
              autoComplete: "street-address",
            })}
          </Field>
          <Field name="city">
            {textField("city", t("member.edit.fields.city"), { autoComplete: "address-level2" })}
          </Field>
          <Field name="state">
            <Controller
              name="state"
              control={control}
              render={({ field, fieldState }) => (
                <Select
                  label={t("member.edit.fields.state")}
                  placeholder={t("member.edit.fields.statePlaceholder")}
                  options={stateOptions}
                  value={field.value === "" ? null : field.value}
                  onChange={(id) => field.onChange(id === NO_STATE ? "" : id)}
                  onBlur={field.onBlur}
                  name={field.name}
                  triggerRef={field.ref}
                  errorMessage={errorText(fieldState.error?.message)}
                />
              )}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex min-w-0 flex-col gap-4">
        <legend className="mb-2 text-base font-semibold text-foreground">
          {t("member.edit.sections.academic")}
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field name="ra">
            {textField("ra", t("member.edit.fields.ra"), { isRequired: true })}
          </Field>
          <Field name="institutionalEmail">
            {textField("institutionalEmail", t("member.edit.fields.institutionalEmail"), {
              type: "email",
              isRequired: true,
            })}
          </Field>
          <Field name="course">
            {textField("course", t("member.edit.fields.course"), { isRequired: true })}
          </Field>
          <Field name="semester">
            {textField("semester", t("member.edit.fields.semester"), {
              inputMode: "numeric",
              description: t("member.edit.fields.semesterHint", MEMBER_LIMITS),
              isRequired: true,
            })}
          </Field>
          <Field name="className">
            {textField("className", t("member.edit.fields.className"), { isRequired: true })}
          </Field>
          <Field name="departmentId">
            <Controller
              name="departmentId"
              control={control}
              render={({ field, fieldState }) => (
                <Select
                  label={t("member.edit.fields.department")}
                  placeholder={
                    isDepartmentsLoading
                      ? t("member.edit.fields.departmentLoading")
                      : t("member.edit.fields.departmentPlaceholder")
                  }
                  options={departmentOptions}
                  value={field.value === "" ? null : field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  triggerRef={field.ref}
                  isDisabled={!canChangeDepartment || departmentOptions.length === 0}
                  description={
                    canChangeDepartment ? undefined : t("member.edit.fields.departmentLocked")
                  }
                  errorMessage={errorText(fieldState.error?.message)}
                />
              )}
            />
          </Field>
          {isDepartmentsError ? (
            <div className="flex flex-col items-start gap-2 sm:col-span-2">
              <Alert variant="error">{t("member.edit.fields.departmentsError")}</Alert>
              <Button variant="secondary" onPress={onRetryDepartments}>
                {t("member.edit.retry")}
              </Button>
            </div>
          ) : null}
          <Field name="mainFunction">
            {textField("mainFunction", t("member.edit.fields.mainFunction"), { isRequired: true })}
          </Field>
          <Field name="joinedAt">{dateField("joinedAt", t("member.edit.fields.joinedAt"))}</Field>
          <Field name="volunteerTermUrl" wide>
            {textField("volunteerTermUrl", t("member.edit.fields.volunteerTermUrl"), {
              inputMode: "url",
              description: t("member.edit.fields.volunteerTermHint"),
            })}
          </Field>
        </div>
      </fieldset>
    </div>
  );
}
