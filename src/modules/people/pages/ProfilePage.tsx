import { useTranslation } from "react-i18next";

import { SignOutButton, useAuth } from "@modules/auth";
import { Alert } from "@shared/ui";

import { CategoryHoursCard } from "../components/CategoryHoursCard";
import { DetailsCard } from "../components/DetailsCard";
import { EntriesCard } from "../components/EntriesCard";
import { HoursSummary } from "../components/HoursSummary";
import { ProfileHeaderCard } from "../components/ProfileHeaderCard";
import { formatDate, formatDateTime } from "../lib/format";
import { profileMock } from "../mocks/profile.mock";

/** `ra` sai tipado como objeto pelo Orval (wart do MeResponseDto do back); em runtime é texto. */
function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * "Meu perfil" (Figma "Telas · Conta"), destino após o login. Nome, perfil e RA vêm da
 * sessão; o resto é `profileMock` até o back ter os dados. O título fica na topbar.
 */
export function ProfilePage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation("people");
  const { t: tCommon } = useTranslation();

  if (!user) return null;

  const profile = profileMock;
  const locale = i18n.language;
  const roleLabel = tCommon(`roles.${user.role}`);
  const ra = textOrNull(user.ra);
  const empty = t("profile.empty");

  return (
    <div className="flex flex-col gap-6">
      <Alert variant="info">{t("profile.mockNotice")}</Alert>

      <ProfileHeaderCard
        name={user.name}
        roleLabel={roleLabel}
        ra={ra}
        status={profile.status}
        department={profile.department}
        joinedAt={profile.joinedAt}
      />

      <HoursSummary hours={profile.hours} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_27.5rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <EntriesCard entries={profile.entries} />
          <CategoryHoursCard period={profile.categoryPeriod} rows={profile.hoursByCategory} />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <DetailsCard
            title={t("profile.personal.title")}
            fields={[
              { label: t("profile.personal.fullName"), value: user.name },
              {
                label: t("profile.personal.birthDate"),
                value: formatDate(profile.personal.birthDate, locale),
              },
              { label: t("profile.personal.phone"), value: profile.personal.phone },
              { label: t("profile.personal.personalEmail"), value: profile.personal.personalEmail },
              { label: t("profile.personal.address"), value: profile.personal.address, wide: true },
              { label: t("profile.personal.city"), value: profile.personal.city },
              { label: t("profile.personal.state"), value: profile.personal.state },
            ]}
          />
          <DetailsCard
            title={t("profile.academic.title")}
            fields={[
              { label: t("profile.academic.ra"), value: ra ?? empty },
              { label: t("profile.academic.department"), value: profile.department },
              { label: t("profile.academic.course"), value: profile.academic.course },
              { label: t("profile.academic.className"), value: profile.academic.className },
              {
                label: t("profile.academic.semester"),
                value: t("profile.academic.semesterValue", { count: profile.academic.semester }),
              },
              {
                label: t("profile.academic.institutionalEmail"),
                value: profile.academic.institutionalEmail,
              },
              { label: t("profile.academic.cpf"), value: profile.academic.cpfMasked },
              { label: t("profile.academic.volunteerTerm"), value: profile.academic.volunteerTerm },
            ]}
          />
          <DetailsCard
            title={t("profile.account.title")}
            fields={[
              { label: t("profile.account.role"), value: roleLabel },
              { label: t("profile.account.status"), value: t(`profile.status.${profile.status}`) },
              { label: t("profile.account.joinedAt"), value: formatDate(profile.joinedAt, locale) },
              {
                label: t("profile.account.lastAccess"),
                value: formatDateTime(profile.lastAccessAt, locale),
              },
            ]}
            footer={<SignOutButton label={t("profile.account.signOut")} />}
          />
        </div>
      </div>
    </div>
  );
}
