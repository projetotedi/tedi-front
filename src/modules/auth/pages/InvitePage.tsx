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

/** Como a página terminou: cadastro ou nova senha concluídos, ou o link deixou de valer no envio. */
type Outcome = { kind: "accepted"; ra: string } | { kind: "passwordChanged" } | { kind: "invalid" };

/** Cartão largo do formulário e cartão estreito das telas de status (medidas do Figma: 800 e 480). */
const FORM_CARD_WIDTH = "max-w-200";
const STATUS_CARD_WIDTH = "max-w-120";

/**
 * Tela pública do link de convite, `/invite?token=...` (e `/reset-password?token=...`, que é o que o
 * back gera para a redefinição de senha). A página decide o que mostrar pelo `type` que
 * `GET /auth/invites/:token` devolve: cadastro em dois passos (`access`) ou só a nova senha
 * (`password_reset`).
 *
 * O token vem só da URL e vai só para o `GET` e para o corpo do `POST`: não entra em estado global,
 * log, armazenamento nem título da página. Quem já está autenticado não é redirecionado, porque pode
 * estar abrindo o link de outra pessoa num computador compartilhado (o endpoint é público).
 */
export function InvitePage(): ReactElement {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // `retry: false`: o back responde 400 a um link que não vale, e isso não muda ao repetir. `gcTime: 0`:
  // o token está na chave da query e não deve sobreviver à saída da página. Nunca é reconsultado
  // sozinho (`staleTime: Infinity`): depois do aceite o link passa a ser inválido, e um segundo `GET`
  // trocaria o cadastro concluído pela tela de link inválido.
  const invite = useGetInvite(token, {
    query: { enabled: token.length > 0, retry: false, staleTime: Infinity, gcTime: 0 },
  });
  const showSlowNotice = useSlowRequestNotice(invite.isPending && token.length > 0);

  useDocumentTitle(
    t(invite.data?.type === InviteType.password_reset ? "resetPassword.title" : "invite.title"),
  );

  function goToLogin() {
    // `replace`: o endereço do convite não serve mais (o link é de uso único) e não deve ficar no
    // histórico, ao alcance do "voltar".
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
          title={t("invite.invalid.title")}
          description={t("invite.invalid.description")}
        >
          <Button fullWidth variant="secondary" onPress={goToLogin}>
            {t("invite.actions.goToLogin")}
          </Button>
        </StatusCard>
      </PublicScreen>
    );
  }

  // Sem resposta do back (sem internet, ou o Render ainda acordando): o link pode estar bom, e o
  // convite é de uso único, então não dá para dizer que ele não vale.
  if (invite.isError) {
    return (
      <PublicScreen cardWidthClassName={STATUS_CARD_WIDTH}>
        <StatusCard
          variant="warning"
          headingLevel={1}
          isAlert
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
        {/* Região viva: o texto troca dentro dela quando a espera passa dos 3 s (Render acordando). */}
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
