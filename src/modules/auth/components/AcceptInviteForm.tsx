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
import { FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Role } from "@shared/lib/role";
import { Alert, Button, Stepper } from "@shared/ui";

import { useInviteAcceptance } from "../hooks/useInviteAcceptance";
import { toAcceptFieldError } from "../lib/invite-error";
import {
  acceptInviteFormSchema,
  STEP_ONE_FIELDS,
  STEP_TWO_FIELDS,
  type AcceptInviteFormValues,
} from "../schemas/password.schema";
import { AcademicStep, STEP_HEADING_CLASS } from "./AcademicStep";
import { PasswordFields } from "./PasswordFields";
import { PersonalStep } from "./PersonalStep";

export interface AcceptInviteFormProps {
  token: string;
  role: Role | null;
  onAccepted: (ra: string) => void;
  onInvalidInvite: () => void;
}

type Step = 1 | 2 | 3;

const TOTAL_STEPS = 3;

const STEP_FIELDS = { 1: STEP_ONE_FIELDS, 2: STEP_TWO_FIELDS } as const;
const NEXT_STEP = { 1: 2, 2: 3 } as const satisfies Record<1 | 2, Step>;
const PREVIOUS_STEP = { 2: 1, 3: 2 } as const satisfies Record<2 | 3, Step>;

const STEP_DESCRIPTION_KEYS = {
  1: "invite.academicStep.description",
  2: "invite.personalStep.description",
  3: "invite.passwordStep.description",
} as const satisfies Record<Step, string>;

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
  const summaryId = useId();

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
    },
  });
  const { handleSubmit, trigger, getValues, setError, setFocus } = form;

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

  async function goToNextStep(from: 1 | 2) {
    const isStepValid = await trigger(STEP_FIELDS[from], { shouldFocus: true });
    if (!isStepValid) return;
    acceptance.reset();
    changeStep(NEXT_STEP[from]);
  }

  function goToPreviousStep(from: 2 | 3) {
    changeStep(PREVIOUS_STEP[from]);
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
    if (step !== TOTAL_STEPS) {
      event.preventDefault();
      void goToNextStep(step);
      return;
    }
    void handleSubmit(submitRegistration)(event);
  }

  const stepNames = [
    t("invite.steps.academic"),
    t("invite.steps.personal"),
    t("invite.steps.password"),
  ];
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
          {t("invite.subtitle", {
            current: step,
            total: TOTAL_STEPS,
            description: t(STEP_DESCRIPTION_KEYS[step]),
          })}
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
        {/* `key` por etapa: sem remontar, o React reaproveita os nós do DOM e um clique repetido em
            "Continuar" cairia no "Enviar cadastro", que ocupa o mesmo lugar. */}
        <Fragment key={`step-${step}`}>
          {step === 1 ? (
            <>
              <AcademicStep headingRef={stepHeadingRef} isDisabled={isBusy} />
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-muted">{t("invite.requiredHint")}</p>
                <Button type="submit">{t("invite.actions.next")}</Button>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <PersonalStep headingRef={stepHeadingRef} isDisabled={isBusy} />
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-muted">{t("invite.requiredHint")}</p>
                <div className="flex gap-3">
                  <Button type="button" variant="secondary" onPress={() => goToPreviousStep(2)}>
                    {t("invite.actions.back")}
                  </Button>
                  <Button type="submit">{t("invite.actions.next")}</Button>
                </div>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div className="flex flex-col gap-4">
                <p
                  id={summaryId}
                  className="rounded-xl bg-tedi-summary px-4 py-3 text-base whitespace-pre-wrap text-foreground"
                >
                  <span className="font-semibold">{name.trim()}</span>
                  {t("invite.passwordStep.summary", { ra: ra.trim() })}
                </p>
                <h2
                  ref={stepHeadingRef}
                  tabIndex={-1}
                  aria-describedby={summaryId}
                  className={STEP_HEADING_CLASS}
                >
                  {t("invite.steps.password")}
                </h2>
                <PasswordFields
                  isDisabled={isBusy}
                  describedBy={generalErrorKey ? errorId : undefined}
                />
              </div>

              <Alert variant="info">{showSlowNotice ? t("invite.slowNotice") : null}</Alert>
              <Alert variant="error" id={errorId}>
                {generalErrorKey ? t(`invite.errors.${generalErrorKey}`) : null}
              </Alert>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  isDisabled={isBusy}
                  onPress={() => goToPreviousStep(3)}
                >
                  {t("invite.actions.back")}
                </Button>
                <Button type="submit" isLoading={isBusy}>
                  {isBusy ? t("invite.actions.submitting") : t("invite.actions.submit")}
                </Button>
              </div>
            </>
          ) : null}
        </Fragment>
      </form>
    </FormProvider>
  );
}
