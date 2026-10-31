import { useId, useState, type ReactElement } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useUpdateAccessEnabled } from "@api/generated";
import type { AccessResponseDto } from "@api/generated/model";
import { Button, Select, toast } from "@shared/ui";

import { useAuth } from "../hooks/useAuth";
import { toAccessActionErrorKey } from "../lib/access-action-error";
import { invalidateAccessList } from "../lib/access-queries";
import { INVITABLE_ROLES, type AssignableRole } from "../lib/role-label";
import { ActionError } from "./ActionError";
import { DisableAccessDialog } from "./DisableAccessDialog";
import { PasswordResetDialog } from "./PasswordResetDialog";

export interface MemberAccessCardProps {
  access: AccessResponseDto;
  /** O perfil escolhido no select. Só vira PATCH quando quem edita salva (`EditMemberDialog`). */
  selectedRole: AssignableRole | null;
  onRoleChange: (role: AssignableRole) => void;
  /** Recebe a pessoa depois de desativar ou reativar o acesso, para a edição se atualizar. */
  onAccessChange: (updated: AccessResponseDto) => void;
  /**
   * A edição está salvando o perfil: o select e as ações (link de redefinição, desativar e
   * reativar) ficam travados até a resposta, que fecha a edição inteira.
   */
  isSaving: boolean;
}

type OpenDialog = "reset" | "disable" | null;

// Pílula do Figma. O botão do HeroUI tem altura fixa e `whitespace-nowrap`: aos 16px, "Gerar link de
// redefinição de senha" não cabe nos 254px úteis do card e vazaria da pílula; aqui o rótulo quebra
// e a altura cresce (o mínimo de 44px continua valendo).
const ACTION_BUTTON_CLASS = "h-auto rounded-3xl py-2 text-center whitespace-normal md:h-auto";

/**
 * Card "Acesso ao sistema" da edição do membro: perfil de acesso, link de redefinição de senha e
 * desativar (ou reativar) o acesso. Quem decide mostrá-lo é a permissão `access.manage`, não este
 * componente. A própria conta só pode gerar o link: perfil e desativar ficam desabilitados.
 */
export function MemberAccessCard({
  access,
  selectedRole,
  onRoleChange,
  onAccessChange,
  isSaving,
}: MemberAccessCardProps): ReactElement {
  const { t } = useTranslation(["auth", "common"]);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const titleId = useId();
  const ownAccountHintId = useId();
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

  // Compara identificadores, nunca perfis: o back recusa (403 OWN_ACCOUNT) e o front só avisa antes.
  const isOwnAccount = user?.id === access.id;

  const enableAccess = useUpdateAccessEnabled({
    mutation: {
      onSuccess: (updated) => {
        void invalidateAccessList(queryClient);
        toast.success(t("access.toast.accessEnabled", { name: access.name }));
        onAccessChange(updated);
      },
    },
  });
  const isEnabling = enableAccess.isPending;
  const enableErrorMessage = enableAccess.isError
    ? t(`access.actionErrors.${toAccessActionErrorKey(enableAccess.error)}`)
    : null;

  const roleOptions = INVITABLE_ROLES.map((role) => ({
    id: role,
    label: t(`roles.${role}`, { ns: "common" }),
  }));
  // Quem tem um perfil que não se atribui (superadmin) não tem opção marcada: o select mostra o
  // rótulo do perfil atual, igual ao da listagem.
  const currentRoleLabel = access.role ? t(`roles.${access.role}`, { ns: "common" }) : "";

  function onRoleSelected(id: string) {
    const role = INVITABLE_ROLES.find((candidate) => candidate === id);
    if (role) onRoleChange(role);
  }

  function toggleAccess() {
    if (access.accessEnabled) {
      setOpenDialog("disable");
      return;
    }
    if (isEnabling) return;
    // Reativar devolve o acesso e não apaga nada: dispensa a confirmação que desativar exige.
    enableAccess.mutate({ id: access.id, data: { enabled: true } });
  }

  const toggleLabel = access.accessEnabled
    ? t("access.memberAccess.disable")
    : isEnabling
      ? t("access.memberAccess.enabling")
      : t("access.memberAccess.enable");

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-xl border border-tedi-border-subtle bg-tedi-surface-subtle p-4"
    >
      <h3 id={titleId} className="text-base font-semibold text-foreground">
        {t("access.memberAccess.title")}
      </h3>

      <Select
        label={t("access.memberAccess.role.label")}
        options={roleOptions}
        value={selectedRole}
        onChange={onRoleSelected}
        formatValue={(selected) => selected?.label ?? currentRoleLabel}
        isDisabled={isOwnAccount || isSaving}
        description={isOwnAccount ? t("access.memberAccess.ownAccount") : undefined}
      />

      {/* Na própria conta continua liberado (o back permite); só trava enquanto a edição salva: o
          sucesso do salvamento fecha a edição e desmontaria o diálogo, e o link gerado nesse
          intervalo (válido por 48 h) se perderia sem ninguém vê-lo. */}
      <Button
        variant="secondary"
        fullWidth
        className={ACTION_BUTTON_CLASS}
        isDisabled={isSaving}
        onPress={() => setOpenDialog("reset")}
      >
        {t("access.memberAccess.resetPassword")}
      </Button>

      <Button
        variant={access.accessEnabled ? "danger-soft" : "secondary"}
        fullWidth
        className={ACTION_BUTTON_CLASS}
        isDisabled={isOwnAccount || isSaving}
        isLoading={isEnabling}
        aria-describedby={isOwnAccount ? ownAccountHintId : undefined}
        onPress={toggleAccess}
      >
        {toggleLabel}
      </Button>
      {isOwnAccount ? (
        <p id={ownAccountHintId} className="text-base text-muted">
          {t("access.memberAccess.ownAccount")}
        </p>
      ) : null}

      <ActionError message={enableErrorMessage} />

      {openDialog === "reset" ? (
        <PasswordResetDialog access={access} onClose={() => setOpenDialog(null)} />
      ) : null}
      {openDialog === "disable" ? (
        <DisableAccessDialog
          access={access}
          onClose={() => setOpenDialog(null)}
          onDisabled={onAccessChange}
        />
      ) : null}
    </section>
  );
}
