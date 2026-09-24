import { useTranslation } from "react-i18next";

import { Button, Card, Chip } from "@shared/ui";

import { formatDate } from "../lib/format";
import { ACCOUNT_STATUS_COLOR } from "../lib/status-colors";
import type { AccountStatus } from "../mocks/profile.mock";

interface ProfileHeaderCardProps {
  name: string;
  roleLabel: string;
  ra: string | null;
  status: AccountStatus;
  department: string;
  joinedAt: string;
}

/**
 * Cabeçalho do perfil. "Editar meus dados" e "Lançar horas" abrem modais que ficam fora
 * da GUS-86; até lá os botões aparecem desabilitados.
 */
export function ProfileHeaderCard({
  name,
  roleLabel,
  ra,
  status,
  department,
  joinedAt,
}: ProfileHeaderCardProps) {
  const { t, i18n } = useTranslation("people");

  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-2xl font-semibold">{name}</p>
          <ul className="flex flex-wrap gap-2">
            <li>
              <Chip color="accent">{roleLabel}</Chip>
            </li>
            <li>
              <Chip color={ACCOUNT_STATUS_COLOR[status]}>{t(`profile.status.${status}`)}</Chip>
            </li>
            {ra && (
              <li>
                <Chip>{t("profile.chips.ra", { ra })}</Chip>
              </li>
            )}
            <li>
              <Chip>{department}</Chip>
            </li>
            <li>
              <Chip>{t("profile.chips.since", { date: formatDate(joinedAt, i18n.language) })}</Chip>
            </li>
          </ul>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" isDisabled>
            {t("profile.actions.editData")}
          </Button>
          <Button isDisabled>{t("profile.actions.logHours")}</Button>
        </div>
      </div>
    </Card>
  );
}
