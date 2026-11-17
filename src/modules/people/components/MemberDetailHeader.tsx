import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { MemberDetailResponseDto } from "@api/generated/model";
import { roleBadgeTone } from "@modules/auth";
import { Badge, Card } from "@shared/ui";

import { MEMBER_STATUS_COLOR } from "../lib/status-colors";

export interface MemberDetailHeaderProps {
  member: MemberDetailResponseDto;
  /**
   * The buttons of the actions area, on the right of the name. The container exists only when
   * there is something in it, so a person with no permission for any action sees no empty box.
   */
  actions?: ReactNode;
}

/**
 * The name of the member and the summary tags: access profile, status, RA and department. The
 * profile is not there while the registration is pending or rejected (`role` is `null`: it is only
 * granted on approval), and the RA and the department show only when the registration has them (the
 * seeded coordinator has no department). The colors follow the Figma: neutral for a member, green
 * for active, blue for the RA and purple for the department; they only reinforce, every tag says
 * what it is in its text.
 *
 * The "42h30 aprovadas" tag of the Figma comes with the hours bank (GUS-165), and not before.
 *
 * The actions go on the right of this row, in the order of the Figma: Inativar (`danger`,
 * `members.deactivate`, GUS-149), Editar membro (`secondary`, `members.edit`, the modal of
 * GUS-148), + Lançar horas (`secondary`, `hours.logForOthers`, GUS-163) and + Nova alocação
 * (`primary`, `assignments.create`, the allocation of E5, GUS-159). None of them exists yet, so the
 * page passes none; each one is shown only with `useCan`, never by comparing the profile.
 */
export function MemberDetailHeader({ member, actions }: MemberDetailHeaderProps): ReactElement {
  const { t } = useTranslation(["people", "common"]);

  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-2xl font-semibold break-words">{member.name}</h2>
          <ul className="flex flex-wrap gap-2">
            {member.role !== null ? (
              <li>
                <Badge tone={roleBadgeTone(member.role)}>{t(`common:roles.${member.role}`)}</Badge>
              </li>
            ) : null}
            <li>
              <Badge tone={MEMBER_STATUS_COLOR[member.status]}>
                {t(`member.status.${member.status}`)}
              </Badge>
            </li>
            {member.ra ? (
              <li>
                <Badge tone="info">{t("member.chips.ra", { ra: member.ra })}</Badge>
              </li>
            ) : null}
            {member.department ? (
              <li>
                <Badge tone="highlight">{member.department.name}</Badge>
              </li>
            ) : null}
          </ul>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </Card>
  );
}
