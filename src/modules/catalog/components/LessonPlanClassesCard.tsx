import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@shared/ui";

/** Classes that already used the plan. Always empty until the lessons module exists. */
export function LessonPlanClassesCard(): ReactElement {
  const { t } = useTranslation("catalog");

  return (
    <Card title={t("detail.classes.title")}>
      <p className="text-base text-muted">{t("detail.classes.empty")}</p>
    </Card>
  );
}
