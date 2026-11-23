import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

/**
 * What `/lessons/:lessonId` shows until the screen of the lesson exists (GUS-156): the page a row of
 * the list and an event of the calendar open. It lives in the module because a module does not
 * import `app/`; the title comes from the topbar, which reads the `handle` of the route.
 */
export function LessonsComingSoonPage(): ReactElement {
  const { t } = useTranslation();

  return <p>{t("comingSoon.description")}</p>;
}
