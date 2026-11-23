import { useId, type ReactElement, type ReactNode } from "react";
import { Controller, useWatch, type Control } from "react-hook-form";
import { useTranslation } from "react-i18next";

import type { DepartmentResponseDto } from "@api/generated/model";
import { Alert, Button, Select, TextArea, TextField } from "@shared/ui";

import { INVITABLE_ROLES } from "../lib/role-label";
import {
  NO_DEPARTMENT,
  REGISTRATION_REVIEW_LIMITS,
  requiresDepartment,
  type RegistrationReviewFormValues,
} from "../schemas/registration-review.schema";

/** Como anda a lista de departamentos: a tela decide o que oferece e se deixa aprovar. */
export type DepartmentsStatus = "loading" | "error" | "empty" | "ready";

export interface RegistrationReviewFieldsProps {
  control: Control<RegistrationReviewFormValues>;
  departments: DepartmentResponseDto[];
  departmentsStatus: DepartmentsStatus;
  /** Id do aviso de erro ou de lista vazia: o botão Aprovar o usa em `aria-describedby`. */
  departmentsNoticeId: string;
  onRetryDepartments: () => void;
  isDisabled: boolean;
}

interface RequiredLabelProps {
  children: ReactNode;
  /**
   * Texto só para leitor de tela. O asterisco é `aria-hidden`, e o `Select` de `shared/ui` não
   * expõe `aria-required` no gatilho (o `TextField` expõe): sem isto o select obrigatório não
   * diria que é obrigatório.
   */
  announcement?: string;
}

function RequiredLabel({ children, announcement }: RequiredLabelProps): ReactElement {
  return (
    <>
      {children}{" "}
      <span className="text-danger" aria-hidden="true">
        *
      </span>
      {announcement ? <span className="sr-only"> ({announcement})</span> : null}
    </>
  );
}

/**
 * O que a coordenação decide ao validar: perfil de acesso, departamento, função principal, data de
 * entrada e a observação. Vem preenchido com o convite e o que o membro indicou (ver
 * `buildReviewDefaults`). O departamento é obrigatório para membro e diretor e opcional para a
 * coordenadora, que ganha a opção "Sem departamento".
 */
export function RegistrationReviewFields({
  control,
  departments,
  departmentsStatus,
  departmentsNoticeId,
  onRetryDepartments,
  isDisabled,
}: RegistrationReviewFieldsProps): ReactElement {
  const { t } = useTranslation(["auth", "common"]);
  const titleId = useId();
  const role = useWatch({ control, name: "role" });
  const isDepartmentRequired = requiresDepartment(role);

  const roleOptions = INVITABLE_ROLES.map((value) => ({
    id: value,
    label: t(`roles.${value}`, { ns: "common" }),
  }));
  const departmentOptions = [
    ...(isDepartmentRequired
      ? []
      : [{ id: NO_DEPARTMENT, label: t("registrationReview.review.noDepartment") }]),
    ...departments.map((department) => ({ id: department.id, label: department.name })),
  ];
  const departmentIds = new Set(departmentOptions.map((option) => option.id));
  // Sem lista (carregando, com erro ou vazia) não há o que escolher: o select fica parado.
  const isDepartmentLocked =
    isDisabled || departmentsStatus === "loading" || departmentOptions.length === 0;

  /** Mensagem de um campo: chave de `validation.*`, com os limites do contrato. */
  const fieldError = (message: string | undefined) =>
    message ? t(`registrationReview.validation.${message}`, REGISTRATION_REVIEW_LIMITS) : undefined;

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 id={titleId} className="text-base font-semibold text-foreground">
          {t("registrationReview.review.title")}
        </h3>
        <p className="text-base text-muted">{t("registrationReview.review.legend")}</p>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <Controller
          name="role"
          control={control}
          render={({ field, fieldState }) => (
            <Select
              label={
                <RequiredLabel announcement={t("registrationReview.required")}>
                  {t("registrationReview.review.role")}
                </RequiredLabel>
              }
              options={roleOptions}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              isRequired
              isDisabled={isDisabled}
              errorMessage={fieldError(fieldState.error?.message)}
            />
          )}
        />

        <Controller
          name="departmentId"
          control={control}
          render={({ field, fieldState }) => {
            // O que aparece escolhido é o que será enviado: um id que a lista não oferece (o
            // indicado pelo membro antes de ela carregar) vale "sem departamento" para a
            // coordenadora e "nada escolhido" para membro e diretor.
            const shown = departmentIds.has(field.value)
              ? field.value
              : departmentIds.has(NO_DEPARTMENT)
                ? NO_DEPARTMENT
                : "";

            return (
              <Select
                label={
                  isDepartmentRequired ? (
                    <RequiredLabel announcement={t("registrationReview.required")}>
                      {t("registrationReview.review.department")}
                    </RequiredLabel>
                  ) : (
                    t("registrationReview.review.department")
                  )
                }
                options={departmentOptions}
                value={shown}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                placeholder={
                  departmentsStatus === "loading"
                    ? t("registrationReview.review.departmentLoading")
                    : t("registrationReview.review.departmentPlaceholder")
                }
                isRequired={isDepartmentRequired}
                isDisabled={isDepartmentLocked}
                errorMessage={fieldError(fieldState.error?.message)}
              />
            );
          }}
        />

        {departmentsStatus === "empty" ? (
          <div className="sm:col-span-2">
            <Alert
              variant="warning"
              id={departmentsNoticeId}
              description={t("registrationReview.departments.emptyDescription")}
            >
              {t("registrationReview.departments.emptyTitle")}
            </Alert>
          </div>
        ) : null}
        {departmentsStatus === "error" ? (
          <div className="flex flex-col items-start gap-2 sm:col-span-2">
            <Alert variant="error" id={departmentsNoticeId}>
              {t("registrationReview.departments.error")}
            </Alert>
            <Button variant="secondary" isDisabled={isDisabled} onPress={onRetryDepartments}>
              {t("registrationReview.departments.retry")}
            </Button>
          </div>
        ) : null}

        <Controller
          name="mainFunction"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              label={<RequiredLabel>{t("registrationReview.review.mainFunction")}</RequiredLabel>}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              isRequired
              isDisabled={isDisabled}
              errorMessage={fieldError(fieldState.error?.message)}
            />
          )}
        />

        <Controller
          name="joinedAt"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              label={<RequiredLabel>{t("registrationReview.review.joinedAt")}</RequiredLabel>}
              type="date"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              isRequired
              isDisabled={isDisabled}
              errorMessage={fieldError(fieldState.error?.message)}
            />
          )}
        />
      </div>

      <Controller
        name="note"
        control={control}
        render={({ field, fieldState }) => (
          <TextArea
            label={t("registrationReview.review.note")}
            description={t("registrationReview.review.noteHelp")}
            rows={4}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            inputRef={field.ref}
            isDisabled={isDisabled}
            errorMessage={fieldError(fieldState.error?.message)}
          />
        )}
      />
    </section>
  );
}
