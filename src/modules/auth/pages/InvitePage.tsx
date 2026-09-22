import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useGetInvite } from "@api/generated";
import { InviteType } from "@api/generated/model";
import { useDocumentTitle } from "@shared/hooks/useDocumentTitle";
import { Alert, Button, StatusCard } from "@shared/ui";

import { AcceptInviteForm } from "../components/AcceptInviteForm";
import { NewPasswordForm } from "../components/NewPasswordForm";
import { PublicScreen } from "../components/PublicScreen";
import { useSlowRequestNotice } from "../hooks/useSlowRequestNotice";
import { toInviteErrorKey } from "../lib/invite-error";
import { INVITE_VALIDITY_HOURS } from "../lib/invite-validity";

type Outcome = { kind: "accepted"; ra: string } | { kind: "passwordChanged" } | { kind: "invalid" };

const FORM_CARD_WIDTH = "max-w-200";
const STATUS_CARD_WIDTH = "max-w-120";

/** Quem já está logado não é redirecionado: pode estar abrindo o link de outra pessoa. */
export function InvitePage(): ReactElement {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // O token só vai ao GET e ao corpo do POST: nunca a log, estado global, armazenamento ou título.
  const token = searchParams.get("token") ?? "";
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // `encodeURIComponent`: o hook gerado interpola o token no caminho sem codificar.
  // `gcTime: 0`: o token está na chave da query e não deve sobreviver à saída da página.
  const invite = useGetInvite(encodeURIComponent(token), {
    query: { enabled: token.length > 0, retry: false, staleTime: Infinity, gcTime: 0 },
  });
  const showSlowNotice = useSlowRequestNotice(invite.isPending && token.length > 0);

  useDocumentTitle(
    t(invite.data?.type === InviteType.password_reset ? "resetPassword.title" : "invite.title"),
  );

  function goToLogin() {
    navigate("/login", { replace: true });
  }

  if (outcome?.kind === "accepted" || outcome?.kind === "passwordChanged") {
    const isPasswordChange = outcome.kind === "passwordChanged";
    return (
      <PublicScreen cardWidthClassName={STATUS_CARD_WIDTH}>
        <StatusCard
          variant="success"
          headingLevel={1}
          autoFocus
          title={t(isPasswordChange ? "resetPassword.success.title" : "invite.success.title")}
          description={
            isPasswordChange
              ? t("resetPassword.success.description")
              : t("invite.success.description", { ra: outcome.ra })
          }
        >
          <Button fullWidth onPress={goToLogin}>
            {t("invite.actions.goToLogin")}
          </Button>
        </StatusCard>
      </PublicScreen>
    );
  }

  const isInviteRejected =
    outcome?.kind === "invalid" ||
    token === "" ||
    (invite.isError && toInviteErrorKey(invite.error) === "invalidInvite");

  if (isInviteRejected) {
    return (
      <PublicScreen cardWidthClassName={STATUS_CARD_WIDTH}>
        <StatusCard
          variant="warning"
          headingLevel={1}
          isAlert
          autoFocus
          title={t("invite.invalid.title")}
          description={t("invite.invalid.description", { hours: INVITE_VALIDITY_HOURS })}
        >
          <Button fullWidth variant="secondary" onPress={goToLogin}>
            {t("invite.actions.goToLogin")}
          </Button>
        </StatusCard>
      </PublicScreen>
    );
  }

  if (invite.isError) {
    return (
      <PublicScreen cardWidthClassName={STATUS_CARD_WIDTH}>
        <StatusCard
          variant="warning"
          headingLevel={1}
          isAlert
          autoFocus
          title={t("invite.loadError.title")}
          description={t("invite.loadError.description")}
        >
          <Button fullWidth onPress={() => void invite.refetch()}>
            {t("invite.actions.retry")}
          </Button>
        </StatusCard>
      </PublicScreen>
    );
  }

  if (!invite.isSuccess) {
    return (
      <PublicScreen cardWidthClassName={FORM_CARD_WIDTH}>
        <h1 className="sr-only">{t("invite.title")}</h1>
        <Alert variant="info">
          {showSlowNotice ? t("invite.slowNotice") : t("invite.loading")}
        </Alert>
      </PublicScreen>
    );
  }

  return (
    <PublicScreen cardWidthClassName={FORM_CARD_WIDTH}>
      {invite.data.type === InviteType.password_reset ? (
        <NewPasswordForm
          token={token}
          onDone={() => setOutcome({ kind: "passwordChanged" })}
          onInvalidInvite={() => setOutcome({ kind: "invalid" })}
        />
      ) : (
        <AcceptInviteForm
          token={token}
          role={invite.data.role}
          onAccepted={(ra) => setOutcome({ kind: "accepted", ra })}
          onInvalidInvite={() => setOutcome({ kind: "invalid" })}
        />
      )}
    </PublicScreen>
  );
}
