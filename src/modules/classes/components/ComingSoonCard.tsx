import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@shared/ui";

export interface ComingSoonCardProps {
  title: string;
}

/**
 * A card of the Figma whose data does not exist yet: "Aulas da turma" waits for the lessons module
 * and "Membros alocados" for the allocation of members. It keeps its place on the screen and says
 * it is coming, with no table, no request and no action.
 */
export function ComingSoonCard({ title }: ComingSoonCardProps): ReactElement {
  const { t } = useTranslation("classes");

  return (
    <Card title={title}>
      <p className="text-base text-muted">{t("detail.comingSoon")}</p>
    </Card>
  );
}
