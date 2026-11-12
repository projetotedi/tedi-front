import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

/**
 * What a field of the course screens shows when it has no value: a dash for who sees it and "Não
 * informado" for who hears it (a lone dash is read as "dash", or not read at all). It is the one
 * rule for an empty value in these screens, the same as the `DetailsCard` of the profile.
 */
export function EmptyValue(): ReactElement {
  const { t } = useTranslation("catalog");

  return (
    <>
      <span aria-hidden="true">{t("course.empty")}</span>
      <span className="sr-only">{t("course.notInformed")}</span>
    </>
  );
}
