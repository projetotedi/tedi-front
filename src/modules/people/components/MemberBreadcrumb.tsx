import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useCan } from "@modules/auth";

import { LINK_CLASSES } from "./link-classes";

export interface MemberBreadcrumbProps {
  /** The name of the member: the current page, the last item of the trail. */
  name: string;
}

/**
 * "Membros › {name}" (the trail of the Figma), above the header of the member. The topbar keeps
 * the static title "Membro" of the route, so the trail lives in the page: the name is a person's
 * data and the topbar only reads the `handle` of the route.
 *
 * "Membros" is a link back to the list only for who can open it. The list is `/members`, the
 * management of accesses, which asks for `access.manage`; the director has `members.view` for the
 * members of the department but not that one, and the link would lead to a page of "no access", so
 * for the director it is plain text. GUS-150 puts the list on `listMembers`: the permission here
 * changes to `members.list` along with the route of the list.
 *
 * The separator is decorative (`aria-hidden`): who hears the trail reads a list of two items, the
 * second one marked as the current page.
 */
export function MemberBreadcrumb({ name }: MemberBreadcrumbProps): ReactElement {
  const { t } = useTranslation(["people", "common"]);
  const canOpenList = useCan("access.manage");
  const listLabel = t("common:nav.members");

  return (
    <nav aria-label={t("member.breadcrumb")}>
      <ol className="flex flex-wrap items-center gap-x-2 text-base text-foreground">
        <li className="flex items-center gap-2">
          {canOpenList ? (
            <Link to="/members" className={LINK_CLASSES}>
              {listLabel}
            </Link>
          ) : (
            <span>{listLabel}</span>
          )}
          <span aria-hidden="true">›</span>
        </li>
        <li className="min-w-0">
          <span aria-current="page" className="font-semibold break-words">
            {name}
          </span>
        </li>
      </ol>
    </nav>
  );
}
