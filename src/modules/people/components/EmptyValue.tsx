import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

/**
 * What a field of the people screens shows when it has no value: a dash for who sees it and "Não
 * informado" for who hears it (a lone dash is read as "dash", or not read at all). It is the one
 * rule for an empty value in this module: the `DetailsCard` and the table of accessibility needs
 * use it, so the profile and the student read the same way.
 */
export function EmptyValue(): ReactElement {
  const { t } = useTranslation("people");

  return (
    <>
      <span aria-hidden="true">{t("profile.empty")}</span>
      <span className="sr-only">{t("profile.notProvided")}</span>
    </>
  );
}
