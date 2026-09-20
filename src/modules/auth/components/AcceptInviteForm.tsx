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
import { Alert, Button, Stepper, TextField } from "@shared/ui";

import { useInviteAcceptance } from "../hooks/useInviteAcceptance";
import { toAcceptFieldError } from "../lib/invite-error";
import { acceptInviteFormSchema, type AcceptInviteFormValues } from "../schemas/password.schema";
import { PasswordFields } from "./PasswordFields";

export interface AcceptInviteFormProps {
  /** Token da URL. Só vai para o corpo do envio: nunca para log, estado global ou armazenamento. */
  token: string;
  /** Perfil que o convite concede (vem de `GET /auth/invites/:token`). */
  role: Role | null;
  /** Cadastro concluído. Recebe o RA digitado, para a tela de sucesso. */
  onAccepted: (ra: string) => void;
  /** O back respondeu `INVALID_INVITE`: o link foi usado, expirou ou foi revogado no meio do caminho. */
  onInvalidInvite: () => void;
}

type Step = 1 | 2;

const TOTAL_STEPS = 2;

/**
 * Título de passo: recebe o foco quando o passo muda (`tabIndex=-1`, só por programa). O anel é o
 * mesmo azul de acento dos campos e dos botões, e não o do navegador (escuro e esticado na largura
 * toda); `w-fit` cola o anel ao texto.
 */
const STEP_HEADING_CLASS =
  "w-fit rounded-md text-base font-semibold text-foreground outline-offset-4 focus-visible:outline-2 focus-visible:outline-focus";
const STEP_ONE_FIELDS = ["name", "ra", "email"] as const;

/** Perfis que um convite de acesso concede. `superadmin` é invisível na interface. */
const ROLE_LABEL_KEYS = {
  [Role.member]: "invite.roles.member",
  [Role.director]: "invite.roles.director",
  [Role.coordinator]: "invite.roles.coordinator",
} as const;

function roleLabelKey(role: Role | null) {
  return role === null || role === Role.superadmin ? null : ROLE_LABEL_KEYS[role];
}

/**
 * Cadastro pelo link de convite (`type=access`), em dois passos: "Seus dados" (nome, RA e e-mail) e
 * "Crie sua senha". Um único formulário cobre os dois passos: os valores do passo 1 continuam no
 * formulário enquanto o passo 2 está na tela, e "Voltar" não perde nada. O passo vive em estado, e
 * não na URL.
 *
 * "Continuar" valida só os campos do passo 1; o envio valida tudo. Enter no passo 1 faz o mesmo que
 * "Continuar" e nunca envia. Ao trocar de passo o foco vai para o título do novo passo e uma região
 * `status` anuncia "Etapa 2 de 2: ...".
 *
 * 409 de RA ou de e-mail voltam ao passo 1 com o erro no campo e o foco nele; o formulário fica aberto.
 */
export function AcceptInviteForm({
  token,
  role,
  onAccepted,
  onInvalidInvite,
}: AcceptInviteFormProps): ReactElement {
  const { t } = useTranslation("auth");
  const errorId = useId();

  const [step, setStep] = useState<Step>(1);
  // A região `status` só anuncia depois da primeira troca de passo (o passo 1 já está na tela).
  const [hasChangedStep, setHasChangedStep] = useState(false);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousStepRef = useRef<Step>(step);

  const form = useForm<AcceptInviteFormValues>({
    resolver: zodResolver(acceptInviteFormSchema),
    mode: "onSubmit",
    defaultValues: { name: "", ra: "", email: "", password: "", passwordConfirmation: "" },
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

  // Foco no título do novo passo. Compara com o passo anterior (e não com "primeira execução") para
  // não roubar o foco na montagem, nem quando o StrictMode executa o efeito duas vezes.
  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    stepHeadingRef.current?.focus();
  }, [step]);

  // Depois de um 409, o foco vai para o campo em conflito. Precisa ser aqui, e não no onError da
  // mutação: o onError roda antes de o React reabilitar os campos e antes de o passo 1 voltar à
  // tela, e um input desabilitado ou desmontado não recebe foco. Declarado depois do efeito acima
  // para vencer o foco no título quando o passo volta a 1 no mesmo render.
  useEffect(() => {
    if (step === 1 && conflictField) setFocus(conflictField);
  }, [step, conflictField, setFocus]);

  // Erro geral (rede ou desconhecido): os campos foram travados durante o envio, o que tira o foco
  // de quem apertou Enter num deles; ele volta ao primeiro campo do passo 2.
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
    // Um erro do envio anterior não pode reaparecer (nem roubar o foco) ao voltar ao passo 2.
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

      {/* Região viva sempre montada (vazia até a primeira troca de passo): leitores de tela só
          anunciam mudanças em regiões que já estavam no DOM. */}
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
        {/* `key` em cada passo: a troca remonta a subárvore inteira. Sem isto o React reaproveitaria
            nós do DOM entre os passos, e um clique repetido em "Continuar" cairia no botão de
            "Enviar cadastro" que ocupa o mesmo lugar. */}
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

            {/* Região viva do aviso de conexão lenta: o Alert info fica sempre montado (vazio) e só
                o texto entra e sai. Não trocar por renderização condicional do Alert: leitores de
                tela não anunciam uma região que nasce já preenchida. */}
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

/** Um dos campos do passo 1, ligado ao formulário pelo contexto. */
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
          // Com o campo em erro, revalida a cada digitação: o erro some assim que o valor passa.
          // Sem isto, um erro de "Continuar" (ou o 409 do RA) ficaria na tela até o próximo
          // "Continuar", porque o formulário só revalida sozinho depois de um envio completo.
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
