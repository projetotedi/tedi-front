import { useId, useState, type ReactElement } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useUpdateAccessRole } from "@api/generated";
import type { AccessResponseDto } from "@api/generated/model";
import { Button, Dialog, toast } from "@shared/ui";

import { useCan } from "../hooks/useCan";
import { toAccessActionErrorKey } from "../lib/access-action-error";
import { accessText } from "../lib/access-format";
import { invalidateAccessList } from "../lib/access-queries";
import { toAssignableRole, type AssignableRole } from "../lib/role-label";
import { ActionError } from "./ActionError";
import { MemberAccessCard } from "./MemberAccessCard";

export interface EditMemberDialogProps {
  /** A linha da listagem. A edição guarda a própria cópia: desativar o acesso a atualiza aqui. */
  member: AccessResponseDto;
  onClose: () => void;
}

/**
 * Modal "Editar membro": dados do membro à esquerda e, para quem gerencia acessos, o card "Acesso
 * ao sistema" à direita. Quem usa o monta só enquanto está aberto.
 *
 * Hoje a coluna de dados é só leitura (o formulário de edição dos dados é da GUS-148) e o único
 * campo salvo é o perfil de acesso, junto com "Salvar alterações" e só se mudou. Desativar,
 * reativar e redefinir senha agem na hora, cada uma com a sua confirmação.
 */
export function EditMemberDialog({ member, onClose }: EditMemberDialogProps): ReactElement {
  const { t } = useTranslation(["auth", "common"]);
  const queryClient = useQueryClient();
  const dataTitleId = useId();
  const canManageAccess = useCan("access.manage");
  const [access, setAccess] = useState(member);
  const [selectedRole, setSelectedRole] = useState<AssignableRole | null>(
    toAssignableRole(member.role),
  );

  const updateRole = useUpdateAccessRole({
    mutation: {
      onSuccess: (_updated, variables) => {
        void invalidateAccessList(queryClient);
        toast.success(
          t("access.toast.roleUpdated", {
            name: access.name,
            role: t(`roles.${variables.data.role}`, { ns: "common" }),
          }),
        );
        onClose();
      },
    },
  });
  const isPending = updateRole.isPending;

  const errorMessage = updateRole.isError
    ? t(`access.actionErrors.${toAccessActionErrorKey(updateRole.error)}`)
    : null;

  function save() {
    if (isPending) return;
    // Sem mudança de perfil (ou sem permissão para mudá-lo) não há o que enviar.
    if (!canManageAccess || selectedRole === null || selectedRole === access.role) {
      onClose();
      return;
    }
    updateRole.mutate(
      { id: access.id, data: { role: selectedRole } },
      {
        onError: (error) => {
          // O perfil não mudou no back: o select volta ao que a pessoa tem.
          if (toAccessActionErrorKey(error) === "lastCoordinator") {
            setSelectedRole(toAssignableRole(access.role));
          }
        },
      },
    );
  }

  const ra = accessText(access.ra);
  const email = accessText(access.email);

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      size="extraWide"
      title={t("access.editMember.title")}
      closeLabel={t("access.editMember.close")}
      isDismissable={!isPending}
      footer={
        <>
          <Button variant="secondary" isDisabled={isPending} onPress={onClose}>
            {t("access.editMember.cancel")}
          </Button>
          <Button isLoading={isPending} onPress={save}>
            {isPending ? t("access.editMember.saving") : t("access.editMember.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ActionError message={errorMessage} />
        <div
          aria-busy={isPending}
          className={`grid gap-6 ${canManageAccess ? "lg:grid-cols-[1fr_288px]" : ""}`}
        >
          <section aria-labelledby={dataTitleId} className="flex flex-col gap-3">
            <h3 id={dataTitleId} className="text-base font-semibold text-foreground">
              {t("access.editMember.dataTitle")}
            </h3>
            <dl className="flex flex-col gap-3">
              <div>
                <dt className="text-base text-muted">{t("access.editMember.summary.name")}</dt>
                <dd className="text-base text-foreground">{access.name}</dd>
              </div>
              {ra ? (
                <div>
                  <dt className="text-base text-muted">{t("access.editMember.summary.ra")}</dt>
                  <dd className="text-base text-foreground">{ra}</dd>
                </div>
              ) : null}
              {email ? (
                <div>
                  <dt className="text-base text-muted">{t("access.editMember.summary.email")}</dt>
                  <dd className="text-base break-all text-foreground">{email}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {canManageAccess ? (
            <MemberAccessCard
              access={access}
              selectedRole={selectedRole}
              onRoleChange={setSelectedRole}
              onAccessChange={setAccess}
              isSaving={isPending}
            />
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
