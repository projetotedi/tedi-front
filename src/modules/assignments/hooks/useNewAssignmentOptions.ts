import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useListLessons } from "@api/generated/lessons/lessons";
import { MemberStatus } from "@api/generated/model";
import { useListMembers } from "@api/generated/people/people";
import type { SelectOption } from "@shared/ui";

import {
  isAssignableMember,
  toClassOptions,
  toLessonOptions,
  toMemberOptions,
} from "../lib/assignment-options";
import { todayIsoDate } from "../lib/format";

/** How many items each query asks for: the biggest page the API gives. The form has no search (F4). */
const OPTIONS_LIMIT = 100;

/** What a select of the form needs to know about the query that feeds it. */
export interface OptionsState {
  options: SelectOption[];
  /**
   * The first answer is still on its way. A query that is turned off is not pending: it is not
   * waiting for anything.
   */
  isPending: boolean;
  isError: boolean;
}

interface OptionsQueryOptions {
  /** Turns the query off: a screen that already knows the member, the class or the lesson does not ask for the list. */
  enabled: boolean;
}

/**
 * The members the form offers: the active ones with access (`status` and `enabled` are filters of
 * the API; the second `enabled` below is the one of the query), up to a page of 100, then the ones
 * that can be assigned (`isAssignableMember`, the mirror of A3). It is `GET /members`, which needs
 * `members.list`: whoever has `assignments.create` has it too.
 */
export function useAssignableMemberOptions({ enabled }: OptionsQueryOptions): OptionsState {
  const query = useListMembers(
    { status: MemberStatus.active, enabled: true, limit: OPTIONS_LIMIT },
    { query: { enabled } },
  );
  const members = query.data?.data;
  const options = useMemo(
    () => toMemberOptions((members ?? []).filter(isAssignableMember)),
    [members],
  );

  return { options, isPending: enabled && query.isPending, isError: query.isError };
}

/**
 * The classes the form offers when the screen does not say which one. The contract has no list of
 * classes (GUS-103 and GUS-170 bring `listClasses`), so they come from the lessons from today on, up
 * to a page of 100 (F2): a class whose next lesson is past the first 100 is not offered, and neither
 * is one with no lesson ahead. Only this body changes when `listClasses` exists.
 */
export function useAssignableClassOptions({ enabled }: OptionsQueryOptions): OptionsState {
  const query = useListLessons(
    { from: todayIsoDate(), limit: OPTIONS_LIMIT },
    { query: { enabled } },
  );
  const lessons = query.data?.data;
  const options = useMemo(() => toClassOptions(lessons ?? []), [lessons]);

  return { options, isPending: enabled && query.isPending, isError: query.isError };
}

/**
 * The lessons the form offers for the class: all of them, past ones included (the allocation of a
 * lesson that already happened is the record the hours need, A12), without the cancelled ones. It
 * asks nothing while there is no class, and it asks again when the class changes.
 */
export function useClassLessonOptions(
  classId: string,
  { enabled = true }: Partial<OptionsQueryOptions> = {},
): OptionsState {
  const { i18n } = useTranslation();
  const isOn = enabled && classId !== "";
  const query = useListLessons({ classId, limit: OPTIONS_LIMIT }, { query: { enabled: isOn } });
  const lessons = query.data?.data;
  const options = useMemo(
    () => toLessonOptions(lessons ?? [], i18n.language),
    [lessons, i18n.language],
  );

  return { options, isPending: isOn && query.isPending, isError: query.isError };
}
