import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

/**
 * What `/lessons` and `/lessons/calendar` show until the list and the calendar exist. It lives in
 * the module because a module does not import `app/`; the title comes from the topbar, which reads
 * the `handle` of the route.
 */
export function LessonsComingSoonPage(): ReactElement {
  const { t } = useTranslation();

  return <p>{t("comingSoon.description")}</p>;
}
