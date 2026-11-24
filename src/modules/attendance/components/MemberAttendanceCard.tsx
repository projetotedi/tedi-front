import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useGetMemberAttendanceHistory } from "@api/generated/attendance/attendance";
import { formatCalendarDate } from "@shared/lib/format";
import { Alert, Button, Card, Skeleton } from "@shared/ui";

import { AttendanceStatusTag } from "./AttendanceStatusTag";

export interface MemberAttendanceCardProps {
  memberId: string;
}

/** The card "Presença" of the sheet of a member: the totals and the lessons, the latest first. */
export function MemberAttendanceCard({ memberId }: MemberAttendanceCardProps): ReactElement {
  const { t, i18n } = useTranslation("attendance");
  const query = useGetMemberAttendanceHistory(memberId);
  const history = query.data;

  if (history === undefined) {
    return (
      <Card title={t("history.title")}>
        {query.isError ? (
          <div className="flex flex-col items-start gap-3">
            <Alert variant="error">{t("history.loadError")}</Alert>
            <Button
              variant="secondary"
              isLoading={query.isFetching}
              onPress={() => void query.refetch()}
            >
              {t("retry")}
            </Button>
          </div>
        ) : (
          <div role="status">
            <p className="sr-only">{t("history.loading")}</p>
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card title={t("history.title")}>
      <p className="text-base">
        {t("history.totals", {
          present: t("history.present", { count: history.totals.present }),
          absent: t("history.absent", { count: history.totals.absent }),
        })}
      </p>
      {history.items.length === 0 ? (
        <p className="pt-3 text-base text-muted">{t("history.empty")}</p>
      ) : (
        <ul aria-label={t("history.listLabel")} className="pt-2">
          {history.items.map((item) => (
            <li
              key={item.lesson.id}
              className="flex items-center justify-between gap-3 border-t border-tedi-divider py-2.5 first:border-t-0"
            >
              <span className="min-w-0 text-base break-words">
                {item.lesson.title}
                <span className="block text-sm text-muted">
                  {formatCalendarDate(item.lesson.date, i18n.language)} · {item.lesson.startTime}–
                  {item.lesson.endTime}
                </span>
              </span>
              <AttendanceStatusTag status={item.status} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
