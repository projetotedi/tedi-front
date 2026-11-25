import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useGetMyProfile } from "@api/generated/people/people";
import { SignOutButton } from "@modules/auth";
import { Alert, Button, Skeleton } from "@shared/ui";

import { DetailsCard } from "../components/DetailsCard";
import { ProfileHeaderCard } from "../components/ProfileHeaderCard";
import { VolunteerTermValue } from "../components/VolunteerTermValue";
import { formatDate, formatInstant, formatPhone } from "../lib/format";
import { accountStatusOf } from "../lib/status-colors";

const TWO_COLUMNS = "grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_27.5rem]";

function ProfileLoading({ label }: { label: string }) {
  return (
    <div role="status" className="flex flex-col gap-6">
      <p className="sr-only">{label}</p>
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className={TWO_COLUMNS}>
        <div className="flex min-w-0 flex-col gap-6">
          <Skeleton className="h-80 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export interface ProfilePageProps {
  /** The actions of other modules in the header, after "Editar meus dados". */
  renderActions: () => ReactNode;
  /** The numbers of the hours, between the header and the columns. */
  renderHoursSummary: () => ReactNode;
  /** The cards of the hours, on top of the main column. */
  renderHoursCards: () => ReactNode;
}

/**
 * "My profile" (Figma "Telas · Conta"), where everyone lands after signing in. Name, role, RA and
 * the whole registration come from `GET /members/me` (GUS-122); a field with no value shows a dash.
 * The hours belong to the `hours` module and arrive through the slots (GUS-163): "+ Lançar horas" in
 * the header, the numbers under it and the cards on top of the main column. The slots are drawn only
 * once the registration is there. The title of the page is on the topbar.
 */
export function ProfilePage({
  renderActions,
  renderHoursSummary,
  renderHoursCards,
}: ProfilePageProps) {
  const { t, i18n } = useTranslation("people");
  const { t: tCommon } = useTranslation();
  // `gcTime: 0` drops the registration from the cache as soon as the page unmounts, which is what
  // happens when the person signs out or the session expires. Without it, whoever signs in on this
  // tab within the global `staleTime` (30 s) would see the previous person's registration.
  const profileQuery = useGetMyProfile({ query: { gcTime: 0 } });
  const profile = profileQuery.data;

  if (profileQuery.isPending) return <ProfileLoading label={t("profile.loading")} />;

  // A 401 also lands here, but the AuthProvider handles it (`tedi:unauthorized`) and sends the
  // person to the sign in screen, so this alert may only flash before the redirect.
  if (profile === undefined) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Alert variant="error">{t("profile.loadError")}</Alert>
        <Button
          variant="secondary"
          isLoading={profileQuery.isFetching}
          onPress={() => void profileQuery.refetch()}
        >
          {t("profile.retry")}
        </Button>
      </div>
    );
  }

  const locale = i18n.language;
  const roleLabel = tCommon(`roles.${profile.role}`);
  const status = accountStatusOf(profile.accessEnabled);
  const department = profile.department?.name ?? null;
  const { birthDate, phone, joinedAt, lastLoginAt, semester, volunteerTermUrl } = profile;

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeaderCard
        name={profile.name}
        roleLabel={roleLabel}
        ra={profile.ra}
        status={status}
        department={department}
        joinedAt={joinedAt}
        actions={renderActions()}
      />

      {renderHoursSummary()}

      <div className={TWO_COLUMNS}>
        <div className="flex min-w-0 flex-col gap-6">{renderHoursCards()}</div>

        <div className="flex min-w-0 flex-col gap-6">
          <DetailsCard
            title={t("profile.personal.title")}
            fields={[
              { label: t("profile.personal.fullName"), value: profile.name },
              {
                label: t("profile.personal.birthDate"),
                value: birthDate && formatDate(birthDate, locale),
              },
              { label: t("profile.personal.phone"), value: phone && formatPhone(phone) },
              { label: t("profile.personal.personalEmail"), value: profile.personalEmail },
              { label: t("profile.personal.address"), value: profile.address, wide: true },
              { label: t("profile.personal.city"), value: profile.city },
              { label: t("profile.personal.state"), value: profile.state },
            ]}
          />
          <DetailsCard
            title={t("profile.academic.title")}
            fields={[
              { label: t("profile.academic.ra"), value: profile.ra },
              { label: t("profile.academic.department"), value: department },
              { label: t("profile.academic.mainFunction"), value: profile.mainFunction },
              { label: t("profile.academic.course"), value: profile.course },
              { label: t("profile.academic.className"), value: profile.className },
              {
                label: t("profile.academic.semester"),
                value:
                  semester === null
                    ? null
                    : t("profile.academic.semesterValue", { count: semester }),
              },
              {
                label: t("profile.academic.institutionalEmail"),
                value: profile.institutionalEmail,
              },
              { label: t("profile.academic.cpf"), value: profile.cpfMasked },
              {
                label: t("profile.academic.volunteerTerm"),
                // `null` (and an empty text) is "no value": the card shows the dash, not an empty box.
                value: volunteerTermUrl && <VolunteerTermValue url={volunteerTermUrl} />,
                wide: true,
              },
            ]}
          />
          <DetailsCard
            title={t("profile.account.title")}
            fields={[
              { label: t("profile.account.role"), value: roleLabel },
              { label: t("profile.account.status"), value: t(`profile.status.${status}`) },
              {
                label: t("profile.account.joinedAt"),
                value: joinedAt && formatDate(joinedAt, locale),
              },
              {
                label: t("profile.account.lastAccess"),
                value: lastLoginAt && formatInstant(lastLoginAt, locale),
              },
            ]}
            footer={<SignOutButton label={t("profile.account.signOut")} />}
          />
        </div>
      </div>
    </div>
  );
}
