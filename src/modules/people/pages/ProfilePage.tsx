import { useTranslation } from "react-i18next";

import { useGetMyProfile } from "@api/generated/people/people";
import { SignOutButton } from "@modules/auth";
import { Alert, Button, Skeleton } from "@shared/ui";

import { CategoryHoursCard } from "../components/CategoryHoursCard";
import { DetailsCard } from "../components/DetailsCard";
import { EntriesCard } from "../components/EntriesCard";
import { HoursSummary } from "../components/HoursSummary";
import { ProfileHeaderCard } from "../components/ProfileHeaderCard";
import { formatDate, formatInstant, formatPhone } from "../lib/format";
import { accountStatusOf } from "../lib/status-colors";
import { isHttpUrl } from "../lib/url";

const TWO_COLUMNS = "grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_27.5rem]";

const TERM_LINK_CLASS =
  "-mx-1 inline-flex min-h-11 items-center rounded-sm px-1 font-medium text-sky-800 underline underline-offset-2 outline-hidden focus-visible:ring-3 focus-visible:ring-focus";

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

/**
 * "My profile" (Figma "Telas · Conta"), where everyone lands after signing in. Name, role, RA and
 * the whole registration come from `GET /members/me` (GUS-122); a field with no value shows a dash.
 * The hours cards stay in an empty state until the hours bank arrives (GUS-163). The title of the
 * page is on the topbar.
 */
export function ProfilePage() {
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

  // A link only for an http(s) URL; anything else the registration holds shows as plain text.
  const volunteerTerm =
    volunteerTermUrl && isHttpUrl(volunteerTermUrl) ? (
      <a
        href={volunteerTermUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={TERM_LINK_CLASS}
      >
        {t("profile.academic.volunteerTermLink")}
        <span className="sr-only"> {t("profile.academic.opensInNewTab")}</span>
      </a>
    ) : (
      volunteerTermUrl
    );

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeaderCard
        name={profile.name}
        roleLabel={roleLabel}
        ra={profile.ra}
        status={status}
        department={department}
        joinedAt={joinedAt}
      />

      <HoursSummary minutes={null} />

      <div className={TWO_COLUMNS}>
        <div className="flex min-w-0 flex-col gap-6">
          <EntriesCard entries={null} />
          <CategoryHoursCard byCategory={null} />
        </div>

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
              { label: t("profile.academic.volunteerTerm"), value: volunteerTerm, wide: true },
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
