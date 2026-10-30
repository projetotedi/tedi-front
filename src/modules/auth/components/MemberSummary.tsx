import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import type { AccessResponseDto } from "@api/generated/model";

import { accessText } from "../lib/access-format";

export interface MemberSummaryProps {
  access: AccessResponseDto;
}

/**
 * Quem é a pessoa da ação (nome, RA e perfil atual), no topo dos modais de redefinição de senha e
 * de desativar acesso. Não mostra "acesso ativo desde": o contrato de `GET /access` não traz a data.
 */
export function MemberSummary({ access }: MemberSummaryProps): ReactElement {
  const { t } = useTranslation(["auth", "common"]);
  const ra = accessText(access.ra);

  return (
    <div className="rounded-xl bg-tedi-surface-subtle px-4 py-3.5">
      <p className="text-base font-semibold text-foreground">
        {ra
          ? t("access.memberSummary.identity", { name: access.name, ra })
          : t("access.memberSummary.identityNoRa", { name: access.name })}
      </p>
      {access.role ? (
        <p className="text-base text-muted">
          {t("access.memberSummary.currentRole", {
            role: t(`roles.${access.role}`, { ns: "common" }),
          })}
        </p>
      ) : null}
    </div>
  );
}
