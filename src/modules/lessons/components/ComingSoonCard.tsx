import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@shared/ui";

export interface ComingSoonCardProps {
  title: string;
}

/**
 * A card of the screen of a lesson whose data does not exist yet: "Registro" waits for the record of the lesson and "Cobertura da aula" for the
 * allocation of members. It keeps its place on the screen and says it is coming, with no table, no
 * request and no action.
 *
 * It is the same card as the one of the `classes` module, copied because a module does not import
 * the inside of another (the copies may drift apart on their own).
 */
export function ComingSoonCard({ title }: ComingSoonCardProps): ReactElement {
  const { t } = useTranslation("lessons");

  return (
    <Card title={title}>
      <p className="text-base text-muted">{t("detail.comingSoon")}</p>
    </Card>
  );
}
