import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FormProvider, useForm, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Role } from "@shared/lib/role";
import { Alert, Button, Checkbox, Stepper, TextField } from "@shared/ui";

import { useInviteAcceptance } from "../hooks/useInviteAcceptance";
import { toAcceptFieldError } from "../lib/invite-error";
import { acceptInviteFormSchema, type AcceptInviteFormValues } from "../schemas/password.schema";
import { PasswordFields } from "./PasswordFields";

export interface AcceptInviteFormProps {
  token: string;
  role: Role | null;
  onAccepted: (ra: string) => void;
  onInvalidInvite: () => void;
}

type Step = 1 | 2;

const TOTAL_STEPS = 2;

const STEP_HEADING_CLASS =
  "w-fit rounded-md text-base font-semibold text-foreground outline-offset-4 focus-visible:outline-2 focus-visible:outline-focus";
const STEP_ONE_FIELDS = ["name", "ra", "email"] as const;

const ROLE_LABEL_KEYS = {
  [Role.member]: "invite.roles.member",
  [Role.director]: "invite.roles.director",
  [Role.coordinator]: "invite.roles.coordinator",
} as const;

function roleLabelKey(role: Role | null) {
  return role === null || role === Role.superadmin ? null : ROLE_LABEL_KEYS[role];
}

export function AcceptInviteForm({
  token,
  role,
  onAccepted,
  onInvalidInvite,
}: AcceptInviteFormProps): ReactElement {
  const { t } = useTranslation("auth");
  const errorId = useId();

  const [step, setStep] = useState<Step>(1);
  const [hasChangedStep, setHasChangedStep] = useState(false);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousStepRef = useRef<Step>(step);

  const form = useForm<AcceptInviteFormValues>({
    resolver: zodResolver(acceptInviteFormSchema),
    mode: "onSubmit",
    defaultValues: {
      name: "",
      ra: "",
      email: "",
      password: "",
      passwordConfirmation: "",
      privacyConsent: false,
    },
  });
  const { control, handleSubmit, trigger, getValues, setError, setFocus } = form;

  const acceptance = useInviteAcceptance({
    onAccepted: () => onAccepted(getValues("ra").trim()),
    onInvalidInvite,
    onConflict: (field, key) => {
      setStep(1);
      setError(field, { message: `invite.errors.${key}` });
    },
  });
  const { isBusy, showSlowNotice, errorKey } = acceptance;
  const conflictField = errorKey ? toAcceptFieldError(errorKey) : null;
  const generalErrorKey = errorKey === "network" || errorKey === "unknown" ? errorKey : null;

  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    stepHeadingRef.current?.focus();
  }, [step]);

  // Em efeito porque o onError roda antes de reabilitar os campos e remontar o passo 1, e input
  // desabilitado ou desmontado não recebe foco. Depois do efeito do título: o último foco vence.
  useEffect(() => {
    if (step === 1 && conflictField) setFocus(conflictField);
  }, [step, conflictField, setFocus]);

  useEffect(() => {
    if (generalErrorKey) setFocus("password");
  }, [generalErrorKey, setFocus]);

  function changeStep(next: Step) {
    setStep(next);
    setHasChangedStep(true);
  }

  async function goToPasswordStep() {
    const isStepValid = await trigger(STEP_ONE_FIELDS, { shouldFocus: true });
    if (!isStepValid) return;
    acceptance.reset();
    changeStep(2);
  }

  function submitRegistration(values: AcceptInviteFormValues) {
    // Campo a campo, nunca `...values`: a confirmação da senha não vai para a rede.
    acceptance.submit({
      token,
      name: values.name,
      ra: values.ra,
      email: values.email,
      password: values.password,
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (step === 1) {
      event.preventDefault();
      void goToPasswordStep();
      return;
    }
    void handleSubmit(submitRegistration)(event);
  }

  const stepNames = [t("invite.steps.personal"), t("invite.steps.password")];
  const roleKey = roleLabelKey(role);
  const [name, ra] = getValues(["name", "ra"]);

  return (
    <FormProvider {...form}>
      <header className="flex flex-col items-center gap-2 text-center">
        <p className="rounded-full bg-tedi-badge px-3 py-1 text-base font-medium text-tedi-badge-foreground">
          {roleKey ? t("invite.badge.withRole", { role: t(roleKey) }) : t("invite.badge.generic")}
        </p>
        <h1 className="text-2xl font-semibold text-foreground">{t("invite.title")}</h1>
        <p className="max-w-130 text-base text-muted">
          {step === 1 ? t("invite.step1.subtitle") : t("invite.step2.subtitle")}
        </p>
      </header>

      <Stepper
        steps={stepNames}
        current={step}
        label={t("invite.stepLabel", { current: step, total: TOTAL_STEPS })}
        completedLabel={t("invite.steps.completed")}
      />
      <div aria-hidden="true" className="h-px bg-separator" />

      {/* Sempre montada: leitores de tela só anunciam mudanças em regiões já presentes no DOM. */}
      <p role="status" aria-live="polite" className="sr-only">
        {hasChangedStep
          ? t("invite.stepStatus", {
              current: step,
              total: TOTAL_STEPS,
              name: stepNames[step - 1],
            })
          : ""}
      </p>

      <form onSubmit={onSubmit} noValidate aria-busy={isBusy} className="flex flex-col gap-5">
        {/* `key` por passo: sem remontar, o React reaproveita os nós do DOM e um clique repetido em
            "Continuar" cairia no "Enviar cadastro", que ocupa o mesmo lugar. */}
        {step === 1 ? (
          <Fragment key="step-1">
            <div className="flex flex-col gap-4">
              <h2 ref={stepHeadingRef} tabIndex={-1} className={STEP_HEADING_CLASS}>
                {t("invite.step1.personalTitle")}
              </h2>
              <StepOneField
                name="name"
                label={t("invite.fields.name.label")}
                autoComplete="name"
                isDisabled={isBusy}
              />
            </div>
            <div className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-foreground">
                {t("invite.step1.academicTitle")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
                <StepOneField
                  name="ra"
                  label={t("invite.fields.ra.label")}
                  description={t("invite.fields.ra.hint")}
                  autoComplete="username"
                  isDisabled={isBusy}
                />
                <StepOneField
                  name="email"
                  label={t("invite.fields.email.label")}
                  type="email"
                  autoComplete="email"
                  isDisabled={isBusy}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted">{t("invite.requiredHint")}</p>
              <Button type="submit">{t("invite.actions.next")}</Button>
            </div>
          </Fragment>
        ) : (
          <Fragment key="step-2">
            <div className="flex flex-col gap-4">
              <h2 ref={stepHeadingRef} tabIndex={-1} className={STEP_HEADING_CLASS}>
                {t("invite.step2.title")}
              </h2>
              <p className="rounded-xl bg-tedi-summary px-4 py-3 text-base whitespace-pre-wrap text-foreground">
                <span className="font-semibold">{name.trim()}</span>
                {t("invite.step2.summary", { ra: ra.trim() })}
              </p>
              <PasswordFields
                isDisabled={isBusy}
                describedBy={generalErrorKey ? errorId : undefined}
              />
            </div>

            <Controller
              name="privacyConsent"
              control={control}
              render={({ field, fieldState }) => (
                <Checkbox
                  label={t("invite.fields.privacyConsent.label")}
                  isSelected={field.value}
                  onChange={field.onChange}
                  isRequired
                  isDisabled={isBusy}
                  errorMessage={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                />
              )}
            />

            <Alert variant="info">{showSlowNotice ? t("invite.slowNotice") : null}</Alert>
            <Alert variant="error" id={errorId}>
              {generalErrorKey ? t(`invite.errors.${generalErrorKey}`) : null}
            </Alert>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                isDisabled={isBusy}
                onPress={() => changeStep(1)}
              >
                {t("invite.actions.back")}
              </Button>
              <Button type="submit" isLoading={isBusy}>
                {isBusy ? t("invite.actions.submitting") : t("invite.actions.submit")}
              </Button>
            </div>
          </Fragment>
        )}
      </form>
    </FormProvider>
  );
}

interface StepOneFieldProps {
  name: (typeof STEP_ONE_FIELDS)[number];
  label: string;
  description?: string;
  type?: "text" | "email";
  autoComplete: string;
  isDisabled: boolean;
}

function StepOneField({
  name,
  label,
  description,
  type,
  autoComplete,
  isDisabled,
}: StepOneFieldProps): ReactElement {
  const { t } = useTranslation("auth");
  const { control, trigger } = useFormContext<AcceptInviteFormValues>();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <TextField
          label={label}
          description={description}
          name={field.name}
          value={field.value}
          onChange={(value) => {
            field.onChange(value);
            if (fieldState.error) void trigger(name);
          }}
          onBlur={field.onBlur}
          inputRef={field.ref}
          type={type}
          autoComplete={autoComplete}
          isRequired
          isDisabled={isDisabled}
          errorMessage={fieldState.error?.message ? t(fieldState.error.message) : undefined}
        />
      )}
    />
  );
}
