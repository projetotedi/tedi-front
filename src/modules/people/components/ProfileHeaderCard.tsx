import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Badge, Button, Card, Chip } from "@shared/ui";

import { formatDate } from "../lib/format";
import { ACCOUNT_STATUS_COLOR, type AccountStatus } from "../lib/status-colors";

interface ProfileHeaderCardProps {
  name: string;
  roleLabel: string;
  ra: string | null;
  status: AccountStatus;
  department: string | null;
  joinedAt: string | null;
  /** The actions of other modules, after "Editar meus dados" (today "+ Lançar horas", by a slot). */
  actions: ReactNode;
}

/**
 * Header of the profile. "Editar meus dados" opens a modal that is another card, so until then it
 * shows disabled; the actions of other modules come in `actions`, after it. The RA, department and
 * "since" chips only show when there is a value: a person with no member profile (the seeded
 * coordinator) has none.
 */
export function ProfileHeaderCard({
  name,
  roleLabel,
  ra,
  status,
  department,
  joinedAt,
  actions,
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
              <Badge tone={ACCOUNT_STATUS_COLOR[status]}>{t(`profile.status.${status}`)}</Badge>
            </li>
            {ra && (
              <li>
                <Chip>{t("profile.chips.ra", { ra })}</Chip>
              </li>
            )}
            {department && (
              <li>
                <Chip>{department}</Chip>
              </li>
            )}
            {joinedAt && (
              <li>
                <Chip>
                  {t("profile.chips.since", { date: formatDate(joinedAt, i18n.language) })}
                </Chip>
              </li>
            )}
          </ul>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" isDisabled>
            {t("profile.actions.editData")}
          </Button>
          {actions}
        </div>
      </div>
    </Card>
  );
}
