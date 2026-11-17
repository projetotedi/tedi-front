import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { isHttpUrl } from "../lib/url";
import { LINK_CLASSES } from "./link-classes";

export interface VolunteerTermValueProps {
  /** `volunteerTermUrl` of the registration, which is typed by people. */
  url: string | null;
}

/**
 * The value of the "Termo de voluntariado" field, the same on "Meu perfil" and on the member: a
 * link that opens in a new tab, but only for an absolute http(s) URL; anything else the
 * registration holds shows as plain text, so a `javascript:` value never reaches an `href`. The
 * link has the target size of the project (44px) and a visible focus, and says that it opens a new
 * tab to who hears it.
 *
 * It renders nothing for `null`, but a component is never "no value" for the `DetailsCard`: whoever
 * uses it renders it only when there is a URL and gives the field `null` otherwise, so the card
 * shows the `EmptyValue` (a dash for who sees it, "Não informado" for who hears it).
 */
export function VolunteerTermValue({ url }: VolunteerTermValueProps): ReactNode {
  const { t } = useTranslation("people");

  if (url === null) return null;
  if (!isHttpUrl(url)) return url;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={LINK_CLASSES}>
      {t("profile.academic.volunteerTermLink")}
      <span className="sr-only"> {t("profile.academic.opensInNewTab")}</span>
    </a>
  );
}
