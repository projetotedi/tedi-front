import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useListInvites } from "@api/generated";
import { ListInvitesStatus } from "@api/generated/model";
import { Button } from "@shared/ui";

export function PendingInvitesButton(): ReactElement | null {
  const { t } = useTranslation("auth");
  const { data } = useListInvites({ status: ListInvitesStatus.pending });

  if (!data) return null;

  // Desabilitado: o modal de convites pendentes é da GUS-88; até lá o botão só mostra a contagem.
  return (
    <Button variant="tertiary" className="rounded-3xl px-4" isDisabled>
      {t("access.people.pendingInvites", { count: data.length })}
    </Button>
  );
}
