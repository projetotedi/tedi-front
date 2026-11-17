import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useGetHourEntryHistory } from "@api/generated/hours/hours";
import {
  HourEntryEventType,
  type HourEntryEventResponseDto,
  type MemberHourEntryResponseDto,
} from "@api/generated/model";
import { formatHours } from "@shared/lib/format";
import { Alert, Button, Dialog, Skeleton } from "@shared/ui";

import { formatInstantDay, formatInstantTime } from "../lib/bank-format";
import { CATEGORY_LABEL_KEYS } from "../lib/bank-labels";
import { EntrySummary } from "./EntrySummary";

export interface EntryHistoryDialogProps {
  /** The entry as it is now (the answer of a review over the row, or the row of the queue). */
  entry: MemberHourEntryResponseDto;
  onClose: () => void;
}

interface EventText {
  title: string;
  detail: string | null;
}

/**
 * "Histórico do lançamento": the current status and the timeline of the entry, the newest first (the
 * API sends the oldest first), with who did what and when, and the justification or the reason. The
 * history cannot be edited nor deleted, which the dialog says. Mounted only while open.
 */
export function EntryHistoryDialog({ entry, onClose }: EntryHistoryDialogProps): ReactElement {
  const { t, i18n } = useTranslation("hours");
  const history = useGetHourEntryHistory(entry.id);
  const events = history.data === undefined ? undefined : [...history.data].reverse();
  const category = t(CATEGORY_LABEL_KEYS[entry.category]);

  function textOf(event: HourEntryEventResponseDto): EventText {
    const actor = event.actor?.name ?? t("history.unknownActor");

    // The contract fills the minutes of a creation (the declared ones) and of a review (declared
    // before, validated after); the type allows null, so the minutes of the entry stand in.
    switch (event.type) {
      case HourEntryEventType.created:
        return {
          title: t("history.events.created", {
            actor,
            hours: formatHours(event.toMinutes ?? entry.declaredMinutes),
            category,
          }),
          detail: event.toStatus === null ? null : t(`history.statusDetail.${event.toStatus}`),
        };
      case HourEntryEventType.adjusted:
        return {
          title: t("history.events.adjusted", {
            actor,
            from: formatHours(event.fromMinutes ?? entry.declaredMinutes),
            to: formatHours(event.toMinutes ?? entry.validatedMinutes ?? entry.declaredMinutes),
          }),
          detail:
            event.note === null ? null : t("history.details.justification", { note: event.note }),
        };
      case HourEntryEventType.approved:
        return {
          title: t("history.events.approved", {
            actor,
            hours: formatHours(event.toMinutes ?? entry.validatedMinutes ?? entry.declaredMinutes),
          }),
          detail: t("history.statusDetail.approved"),
        };
      case HourEntryEventType.rejected:
        return {
          title: t("history.events.rejected", { actor }),
          detail: event.note === null ? null : t("history.details.reason", { note: event.note }),
        };
      case HourEntryEventType.removed:
        return { title: t("history.events.removed", { actor }), detail: null };
      case HourEntryEventType.reversed:
        return { title: t("history.events.reversed"), detail: t("history.details.reversed") };
      default: {
        const exhaustive: never = event.type;
        return exhaustive;
      }
    }
  }

  function renderTimeline(): ReactElement {
    if (history.isPending) {
      return (
        <div role="status" className="flex flex-col gap-3">
          <p className="sr-only">{t("history.loading")}</p>
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      );
    }

    if (events === undefined) {
      return (
        <div className="flex flex-col items-start gap-3">
          <Alert variant="error">{t("history.loadError")}</Alert>
          <Button
            variant="secondary"
            isLoading={history.isFetching}
            onPress={() => void history.refetch()}
          >
            {t("history.retry")}
          </Button>
        </div>
      );
    }

    return (
      <ol aria-label={t("history.timeline")} className="flex flex-col">
        {events.map((event, index) => {
          const { title, detail } = textOf(event);
          return (
            <li
              key={event.id}
              className="flex gap-3 border-b border-tedi-divider py-3 last:border-b-0"
            >
              <span
                aria-hidden="true"
                className={`mt-1.5 size-2.5 shrink-0 rounded-full ${index === 0 ? "bg-accent" : "bg-tedi-divider"}`}
              />
              <div className="flex flex-col gap-1">
                <p className="text-sm text-muted">
                  <time dateTime={event.createdAt}>
                    {t("history.when", {
                      date: formatInstantDay(event.createdAt, i18n.language),
                      time: formatInstantTime(event.createdAt, i18n.language),
                    })}
                  </time>
                </p>
                <p className="text-base font-semibold text-foreground">{title}</p>
                {detail === null ? null : <p className="text-sm text-muted">{detail}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      title={t("history.title")}
      closeLabel={t("history.close")}
      footer={
        <Button variant="primary" onPress={onClose}>
          {t("history.close")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <EntrySummary
          entry={entry}
          detail={t(`history.current.${entry.status}`, {
            declared: formatHours(entry.declaredMinutes),
            validated: formatHours(entry.validatedMinutes ?? 0),
          })}
        />
        {renderTimeline()}
        <p className="text-sm text-muted">{t("history.immutable")}</p>
      </div>
    </Dialog>
  );
}
