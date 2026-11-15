import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch, type FieldErrors, type Resolver } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { MemberRegistrationStatus, type MemberRegistrationResponseDto } from "@api/generated/model";
import {
  getGetMemberRegistrationQueryKey,
  getListDepartmentsQueryKey,
  useApproveMemberRegistration,
  useGetMemberRegistration,
  useListDepartments,
  useRejectMemberRegistration,
} from "@api/generated/people/people";
import { Alert, Badge, Button, Dialog, Skeleton, toast } from "@shared/ui";

import { useCan } from "../hooks/useCan";
import { formatSubmittedAt, todayInAppTimeZone } from "../lib/registration-format";
import { invalidateMemberLists } from "../lib/registration-queries";
import {
  isRegistrationNotFound,
  REGISTRATION_REVIEW_FIELD_ORDER,
  toRegistrationReviewError,
  type RegistrationReviewErrorKind,
  type RegistrationReviewField,
} from "../lib/registration-review-error";
import {
  buildReviewDefaults,
  createApproveReviewSchema,
  REGISTRATION_REVIEW_LIMITS,
  rejectReviewSchema,
  requiresDepartment,
  toApproveBody,
  toRejectBody,
  type RegistrationReviewFormValues,
} from "../schemas/registration-review.schema";
import { RegistrationReviewFields, type DepartmentsStatus } from "./RegistrationReviewFields";
import { RegistrationSubmittedData } from "./RegistrationSubmittedData";

export interface ValidateRegistrationDialogProps {
  /** Id da pessoa (o mesmo de `GET /member-registrations/:id`). Monte o diálogo só com um cadastro escolhido. */
  registrationId: string;
  onClose: () => void;
  /** Depois de aprovar ou recusar, com o cadastro como o back o devolveu. O diálogo se fecha em seguida. */
  onReviewed?: (registration: MemberRegistrationResponseDto) => void;
}

type ReviewAction = "approve" | "reject";

/**
 * O que o alerta do formulário diz: um erro da ação ou a mensagem de um campo que o select não
 * deixa focar (chave de `registrationReview.validation.*`, venha do schema ou do back).
 */
type SubmitError = { kind: RegistrationReviewErrorKind } | { kind: "field"; message: string };

const EMPTY_VALUES: RegistrationReviewFormValues = {
  role: "",
  departmentId: "",
  mainFunction: "",
  joinedAt: "",
  note: "",
};

/** Campos com `ref` de input: o foco vai direto neles. O `Select` de `shared/ui` não expõe ref. */
const FOCUSABLE_FIELDS: ReadonlySet<RegistrationReviewField> = new Set<RegistrationReviewField>([
  "mainFunction",
  "joinedAt",
  "note",
]);

const rejectResolver = zodResolver(rejectReviewSchema);

/**
 * Valida o cadastro de um membro (RF-004, RN-08): a coordenação confere os dados que ele enviou,
 * define perfil, departamento, função e entrada e aprova, ou recusa com uma observação. Só abre com
 * `invites.manage` (a mesma permissão das rotas): sem ela não renderiza nada e não pede nada à API.
 */
export function ValidateRegistrationDialog(
  props: ValidateRegistrationDialogProps,
): ReactElement | null {
  const canReview = useCan("invites.manage");
  if (!canReview) return null;

  // O `key` zera o formulário e os erros se quem monta o diálogo trocar de cadastro.
  return <ValidateRegistrationContent key={props.registrationId} {...props} />;
}

function ValidateRegistrationContent({
  registrationId,
  onClose,
  onReviewed,
}: ValidateRegistrationDialogProps): ReactElement {
  const { t, i18n } = useTranslation(["auth", "common"]);
  const queryClient = useQueryClient();
  const departmentsNoticeId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<ReviewAction>("approve");
  const inFlightRef = useRef(false);
  const prefilledIdRef = useRef<string | null>(null);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [focusField, setFocusField] = useState<RegistrationReviewField | null>(null);
  // Depois de um 409 outra pessoa já decidiu: as ações ficam travadas, mas o diálogo não fecha sozinho.
  const [isLocked, setIsLocked] = useState(false);
  const locale = i18n.resolvedLanguage ?? i18n.language;

  // O cadastro tem CPF e endereço: sai do cache quando o diálogo desmonta e nunca é reaproveitado.
  const registrationQuery = useGetMemberRegistration(registrationId, {
    query: { staleTime: 0, gcTime: 0 },
  });
  const departmentsQuery = useListDepartments();
  const registration = registrationQuery.data;

  const departments = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data]);
  const departmentIds = useMemo(
    () => new Set(departments.map((department) => department.id)),
    [departments],
  );
  const departmentsStatus: DepartmentsStatus = departmentsQuery.isPending
    ? "loading"
    : departments.length > 0
      ? "ready"
      : departmentsQuery.isError
        ? "error"
        : "empty";

  // Um formulário só: o resolver muda conforme o botão (recusar só olha a observação).
  const resolver: Resolver<RegistrationReviewFormValues> = (values, context, options) =>
    actionRef.current === "reject"
      ? rejectResolver(values, context, options)
      : zodResolver(createApproveReviewSchema(departmentIds, todayInAppTimeZone()))(
          values,
          context,
          options,
        );
  // `shouldFocusError` desligado: o foco do primeiro campo com problema é daqui (`pointAtField`). O
  // do react-hook-form foca o primeiro campo com `ref` que errou, e passaria por cima de um select
  // (sem `ref`) que errou antes, além de voltar a roubar o foco do alerta num `setTimeout`.
  const { control, handleSubmit, clearErrors, setError, setFocus, reset } =
    useForm<RegistrationReviewFormValues>({
      resolver,
      defaultValues: EMPTY_VALUES,
      shouldFocusError: false,
    });
  const role = useWatch({ control, name: "role" });

  // Preenche o formulário uma vez por cadastro, antes de pintar, para os campos não aparecerem vazios.
  useLayoutEffect(() => {
    if (registration === undefined || prefilledIdRef.current === registration.id) return;
    prefilledIdRef.current = registration.id;
    reset(buildReviewDefaults(registration));
  }, [registration, reset]);

  // O erro pede o foco; com o foco no alerta, o leitor de tela o lê.
  useEffect(() => {
    if (submitError !== null) errorRef.current?.focus();
  }, [submitError]);

  // O foco no campo com erro vem depois do render que reabilita os campos: um input desabilitado não o recebe.
  useEffect(() => {
    if (focusField !== null) setFocus(focusField);
  }, [focusField, setFocus]);

  const roleLabel = (value: string) => t(`roles.${value}`, { ns: "common" });

  function finishReview(response: MemberRegistrationResponseDto) {
    // A resposta já é o cadastro decidido: o detalhe fica certo sem outra ida à API.
    queryClient.setQueryData(getGetMemberRegistrationQueryKey(registrationId), response);
    void invalidateMemberLists(queryClient);
  }

  const approveMutation = useApproveMemberRegistration({
    mutation: {
      onSuccess: (response, variables) => {
        finishReview(response);
        const grantedRole = roleLabel(response.role ?? variables.data.role);
        toast.success(t("registrationReview.toast.approvedTitle"), {
          description:
            response.ra === null
              ? t("registrationReview.toast.approvedDescriptionNoRa", {
                  name: response.name,
                  role: grantedRole,
                })
              : t("registrationReview.toast.approvedDescription", {
                  name: response.name,
                  role: grantedRole,
                  ra: response.ra,
                }),
        });
      },
    },
  });
  const rejectMutation = useRejectMemberRegistration({
    mutation: {
      onSuccess: (response) => {
        finishReview(response);
        toast.error(t("registrationReview.toast.rejectedTitle"), {
          description: t("registrationReview.toast.rejectedDescription", { name: response.name }),
        });
      },
    },
  });
  const isBusy = approveMutation.isPending || rejectMutation.isPending;
  const areFieldsDisabled = isBusy || isLocked;

  /**
   * Leva a pessoa ao campo com problema: input de texto recebe o foco; o select não expõe `ref`, então
   * a mensagem dele sobe para o alerta, que recebe o foco e é lido pelo leitor de tela.
   */
  function pointAtField(name: RegistrationReviewField, message: string) {
    if (FOCUSABLE_FIELDS.has(name)) setFocusField(name);
    else setSubmitError({ kind: "field", message });
  }

  // Validação do formulário, antes de enviar: o primeiro campo com erro, na ordem da tela.
  function handleInvalid(errors: FieldErrors<RegistrationReviewFormValues>) {
    for (const name of REGISTRATION_REVIEW_FIELD_ORDER) {
      const message = errors[name]?.message;
      if (typeof message === "string") {
        pointAtField(name, message);
        return;
      }
    }
  }

  function handleError(error: unknown) {
    const result = toRegistrationReviewError(error);

    if (result.kind === "fields") {
      for (const { name, message } of result.fields) setError(name, { type: "server", message });
      if (result.fields.some(({ message }) => message === "departmentNotFound")) {
        void queryClient.invalidateQueries({ queryKey: getListDepartmentsQueryKey() });
      }

      const [first] = result.fields;
      pointAtField(first.name, first.message);
      return;
    }

    if (result.kind === "notPending") {
      setIsLocked(true);
      void invalidateMemberLists(queryClient);
    }
    setSubmitError({ kind: result.kind });
  }

  const mutationCallbacks = {
    onSuccess: (response: MemberRegistrationResponseDto) => {
      onReviewed?.(response);
      onClose();
    },
    onError: handleError,
    onSettled: () => {
      inFlightRef.current = false;
    },
  };

  // A trava é síncrona: o `handleSubmit` valida de forma assíncrona e `isPending` só chega no
  // render seguinte, então dois cliques passariam os dois pela validação antes dela valer.
  function approve(values: RegistrationReviewFormValues) {
    if (isBusy || inFlightRef.current) return;
    inFlightRef.current = true;
    approveMutation.mutate(
      { id: registrationId, data: toApproveBody(values, departmentIds) },
      mutationCallbacks,
    );
  }

  function reject(values: RegistrationReviewFormValues) {
    if (isBusy || inFlightRef.current) return;
    inFlightRef.current = true;
    rejectMutation.mutate({ id: registrationId, data: toRejectBody(values) }, mutationCallbacks);
  }

  function startReview(action: ReviewAction) {
    if (isBusy || isLocked || inFlightRef.current) return;
    actionRef.current = action;
    setSubmitError(null);
    setFocusField(null);
    clearErrors();
    void handleSubmit(action === "approve" ? approve : reject, handleInvalid)();
  }

  const isPendingRegistration =
    registration?.registrationStatus === MemberRegistrationStatus.pending;
  const isBlockedByDepartments = requiresDepartment(role) && departmentsStatus !== "ready";
  const hasDepartmentsNotice = departmentsStatus === "empty" || departmentsStatus === "error";

  const footer = (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <Button variant="tertiary" isDisabled={isBusy} onPress={onClose}>
        {t("registrationReview.back")}
      </Button>
      {isPendingRegistration ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            variant="danger-soft"
            isDisabled={isBusy || isLocked}
            isLoading={rejectMutation.isPending}
            onPress={() => startReview("reject")}
          >
            {rejectMutation.isPending
              ? t("registrationReview.actions.rejecting")
              : t("registrationReview.actions.reject")}
          </Button>
          <Button
            isDisabled={isBusy || isLocked || isBlockedByDepartments}
            isLoading={approveMutation.isPending}
            aria-describedby={
              isBlockedByDepartments && hasDepartmentsNotice ? departmentsNoticeId : undefined
            }
            onPress={() => startReview("approve")}
          >
            {approveMutation.isPending
              ? t("registrationReview.actions.approving")
              : t("registrationReview.actions.approve")}
          </Button>
        </div>
      ) : null}
    </div>
  );

  function renderBody(): ReactElement {
    if (registration === undefined) {
      return registrationQuery.isError ? (
        <LoadError
          isNotFound={isRegistrationNotFound(registrationQuery.error)}
          onRetry={() => void registrationQuery.refetch()}
        />
      ) : (
        <LoadingState />
      );
    }

    if (!isPendingRegistration) {
      return (
        <div className="flex flex-col gap-5">
          <Alert variant="warning" description={t("registrationReview.decided.description")}>
            {registration.registrationStatus === MemberRegistrationStatus.approved
              ? t("registrationReview.decided.approved")
              : t("registrationReview.decided.rejected")}
          </Alert>
          <RegistrationSubmittedData registration={registration} />
        </div>
      );
    }

    return (
      <form
        noValidate
        aria-busy={isBusy}
        // Nenhum botão envia o formulário: Enter num campo não aprova nem recusa por engano.
        onSubmit={(event) => event.preventDefault()}
        className="flex flex-col gap-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-tedi-summary px-4 py-3">
          <p className="text-base text-foreground">
            {registration.submittedAt === null
              ? t("registrationReview.summary.sentNoDate", { name: registration.name })
              : t("registrationReview.summary.sent", {
                  name: registration.name,
                  submittedAt: formatSubmittedAt(registration.submittedAt, locale),
                })}
            {registration.requestedRole === null
              ? null
              : t("registrationReview.summary.invitedAs", {
                  role: roleLabel(registration.requestedRole),
                })}
          </p>
          <Badge tone="info">{t("registrationReview.badge")}</Badge>
        </div>

        <RegistrationSubmittedData registration={registration} />

        <hr className="border-tedi-divider" />

        <RegistrationReviewFields
          control={control}
          departments={departments}
          departmentsStatus={departmentsStatus}
          departmentsNoticeId={departmentsNoticeId}
          onRetryDepartments={() => void departmentsQuery.refetch()}
          isDisabled={areFieldsDisabled}
        />

        {submitError !== null ? (
          <div ref={errorRef} tabIndex={-1} className="outline-none">
            <Alert variant="error">
              {submitError.kind === "field"
                ? t(
                    `registrationReview.validation.${submitError.message}`,
                    REGISTRATION_REVIEW_LIMITS,
                  )
                : t(`registrationReview.errors.${submitError.kind}`)}
            </Alert>
          </div>
        ) : null}
      </form>
    );
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("registrationReview.title")}
      closeLabel={t("registrationReview.close")}
      size="wide"
      isDismissable={!isBusy}
      footer={footer}
    >
      {renderBody()}
    </Dialog>
  );
}

function LoadingState(): ReactElement {
  const { t } = useTranslation("auth");

  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <p role="status" className="text-base text-foreground">
        {t("registrationReview.loading")}
      </p>
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}

interface LoadErrorProps {
  isNotFound: boolean;
  onRetry: () => void;
}

function LoadError({ isNotFound, onRetry }: LoadErrorProps): ReactElement {
  const { t } = useTranslation("auth");

  return (
    <div className="flex flex-col items-start gap-3">
      <Alert variant="error">
        {isNotFound
          ? t("registrationReview.loadError.notFound")
          : t("registrationReview.loadError.failed")}
      </Alert>
      {isNotFound ? null : (
        <Button variant="secondary" onPress={onRetry}>
          {t("registrationReview.loadError.retry")}
        </Button>
      )}
    </div>
  );
}
