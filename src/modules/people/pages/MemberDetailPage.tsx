import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import type { MemberDetailResponseDto } from "@api/generated/model";
import { useGetMember } from "@api/generated/people/people";
import { ForbiddenPage, useCan } from "@modules/auth";
import { Alert, Button, Card, Skeleton } from "@shared/ui";

import { LINK_CLASSES } from "../components/link-classes";
import { MemberAssignmentsCard } from "../components/MemberAssignmentsCard";
import { MemberAttendanceCard } from "../components/MemberAttendanceCard";
import { MemberBreadcrumb } from "../components/MemberBreadcrumb";
import { MemberDataCard } from "../components/MemberDataCard";
import { MemberDetailHeader } from "../components/MemberDetailHeader";
import { MemberEntriesCard } from "../components/MemberEntriesCard";
import { MemberHoursBankCard } from "../components/MemberHoursBankCard";
import { MemberRecordCard } from "../components/MemberRecordCard";
import { isMemberForbidden, isMemberId, isMemberNotFound } from "../lib/member";

/**
 * The two columns start at 90rem (1440px, the width of the Figma). The main column holds a card of
 * three columns and two tables; with the side column at 27.5rem they would be left with about 24rem
 * at 1280px. Below 90rem the cards stack in one column and have the whole width. The same
 * breakpoint as the screen of a student and the one of a course.
 */
const TWO_COLUMNS = "grid grid-cols-1 gap-5 min-[90rem]:grid-cols-[minmax(0,1fr)_27.5rem]";

function LoadingPlaceholder({ label }: { label: string }): ReactElement {
  return (
    <div role="status" className="flex flex-col gap-5">
      <p className="sr-only">{label}</p>
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className={TWO_COLUMNS}>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

/**
 * The member does not exist, or the id cannot be one: the page says it. The way back to the list is
 * only offered to who can open it (`access.manage`, the permission of `/members` today); the
 * director cannot, and a link to a page of "no access" would not be a way back.
 */
function MemberNotFound(): ReactElement {
  const { t } = useTranslation("people");
  const canOpenList = useCan("access.manage");

  return (
    <Card title={t("member.notFoundTitle")}>
      <div className="flex flex-col items-start gap-3">
        <p className="text-base text-muted">{t("member.notFoundDescription")}</p>
        {canOpenList ? (
          <Link to="/members" className={LINK_CLASSES}>
            {t("member.backToList")}
          </Link>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * The member that was loaded: the trail, the header and the two columns of cards. No action is
 * passed to the header yet; see `MemberDetailHeader`.
 */
function MemberDetailView({ member }: { member: MemberDetailResponseDto }): ReactElement {
  return (
    <div className="flex flex-col gap-5">
      <MemberBreadcrumb name={member.name} />
      <MemberDetailHeader member={member} />
      <div className={TWO_COLUMNS}>
        <div className="flex min-w-0 flex-col gap-5">
          <MemberDataCard member={member} />
          <MemberAssignmentsCard />
          <MemberEntriesCard />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <MemberHoursBankCard />
          <MemberAttendanceCard />
          <MemberRecordCard reviewedBy={member.reviewedBy} reviewedAt={member.reviewedAt} />
        </div>
      </div>
    </div>
  );
}

function MemberDetail({ memberId }: { memberId: string }): ReactElement {
  const { t } = useTranslation("people");
  // `gcTime: 0` drops the registration from the cache as soon as the page unmounts, which is what
  // happens when the person signs out or the session expires. It holds the phone, the address and
  // the masked CPF of a person, and signing out does not clear the cache: without it, whoever signs
  // in on this tab within the global `staleTime` (30 s) would see the registration that the
  // previous person opened (the same reason as "Meu perfil").
  const memberQuery = useGetMember(memberId, { query: { gcTime: 0 } });
  const member = memberQuery.data;

  if (memberQuery.isPending) return <LoadingPlaceholder label={t("member.loading")} />;

  if (member === undefined) {
    if (isMemberNotFound(memberQuery.error)) return <MemberNotFound />;
    // The member is outside the scope of the person (a director opening a member of another
    // department) or the permission was taken away since the route opened: the page of no access,
    // with the session kept, as for any other route (decision 18).
    if (isMemberForbidden(memberQuery.error)) return <ForbiddenPage />;

    // A 401 also lands here, but the AuthProvider handles it (`tedi:unauthorized`) and sends the
    // person to the sign in screen, so this alert may only flash before the redirect.
    return (
      <div className="flex flex-col items-start gap-3">
        <Alert variant="error">{t("member.loadError")}</Alert>
        <Button
          variant="secondary"
          isLoading={memberQuery.isFetching}
          onPress={() => void memberQuery.refetch()}
        >
          {t("member.retry")}
        </Button>
      </div>
    );
  }

  return <MemberDetailView member={member} />;
}

/**
 * The screen of a member (GUS-145, Figma "Membro · detalhe"), opened from the row of the list of
 * members. The page asks the API for one thing, `getMember` (`members.view`), and the header and
 * the cards that show data come from that answer. Alocações em aulas, Lançamentos de horas, Banco de
 * horas and Presença are cards that say "em breve": each one is filled by its own task (GUS-159,
 * GUS-163, GUS-165 and GUS-169) and will ask for its data inside itself, so that a failure of one
 * query shows only in that card and the rest of the screen keeps its data.
 *
 * The title of the page is on the topbar (`handle.title` of the route) and it is static, "Membro":
 * the topbar only reads the `handle`, so the trail "Membros › name" is part of the page, above the
 * header, and the name is the `<h2>` of the header. The page has no `<h1>` and no
 * `useDocumentTitle`.
 *
 * A 403 (`FORBIDDEN` or `FORBIDDEN_SCOPE`, the member is of another department) shows the page of no
 * access, and the 404 `MEMBER_NOT_FOUND` shows "Membro não encontrado". An id that is not a UUID is
 * "not found" at once, with no request. The id is also the `key` of the detail, so nothing of a
 * member stays on the screen when the route changes to another one.
 */
export function MemberDetailPage(): ReactElement {
  const { memberId = "" } = useParams();

  if (!isMemberId(memberId)) return <MemberNotFound />;

  return <MemberDetail key={memberId} memberId={memberId} />;
}
