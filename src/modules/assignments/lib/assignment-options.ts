import {
  LessonStatus,
  MemberRegistrationStatus,
  MemberStatus,
  type LessonListItemResponseDto,
  type MemberListItemResponseDto,
} from "@api/generated/model";
import type { SelectOption } from "@shared/ui";

import { formatDayMonth } from "./format";

/** The names are Brazilian Portuguese, so the order is the one of its alphabet ("Á" is among the "A"). */
const COLLATOR = new Intl.Collator("pt-BR");

function byLabel(first: SelectOption, second: SelectOption): number {
  return COLLATOR.compare(first.label, second.label);
}

/**
 * The classes the form offers, taken from the lessons the API listed (there is no list of classes
 * in the contract yet): one option per class, labelled with its name (the API gives the code when it
 * has no name), in alphabetical order. A class that appears in many lessons is one option.
 */
export function toClassOptions(lessons: readonly LessonListItemResponseDto[]): SelectOption[] {
  const byId = new Map<string, SelectOption>();

  for (const { class: lessonClass } of lessons) {
    if (!byId.has(lessonClass.id))
      byId.set(lessonClass.id, { id: lessonClass.id, label: lessonClass.name });
  }

  return [...byId.values()].sort(byLabel);
}

/**
 * The lessons the form offers for a class, labelled as the Figma does ("10/03 · Senhas e
 * privacidade") and in the order of the API (the date). A cancelled lesson is left out: the API
 * answers 409 `LESSON_CANCELLED` for it (F4.5), so the form does not offer what it knows will be
 * refused. A lesson of the past is offered, because the allocation of a lesson that already
 * happened is the record the hours need (A12).
 */
export function toLessonOptions(
  lessons: readonly LessonListItemResponseDto[],
  locale: string,
): SelectOption[] {
  return lessons
    .filter((lesson) => lesson.status !== LessonStatus.cancelled)
    .map((lesson) => ({
      id: lesson.id,
      label: `${formatDayMonth(lesson.date, locale)} · ${lesson.title}`,
    }));
}

/**
 * Whether a member of the list can be assigned to a lesson: the mirror of the rule of the API (A3),
 * so the form does not offer who it will refuse with 409 `MEMBER_INACTIVE`. It takes an access role
 * (a person with no role is not a member), the access turned on, the participation in the project
 * active, and a registration that is not waiting or refused. A coordinator who has no member
 * profile has no registration status and is assignable.
 */
export function isAssignableMember(member: MemberListItemResponseDto): boolean {
  return (
    member.status === MemberStatus.active &&
    member.accessEnabled &&
    member.role !== null &&
    member.registrationStatus !== MemberRegistrationStatus.pending &&
    member.registrationStatus !== MemberRegistrationStatus.rejected
  );
}

/** The members the form offers, labelled with their names and in alphabetical order. */
export function toMemberOptions(members: readonly MemberListItemResponseDto[]): SelectOption[] {
  return members.map((member) => ({ id: member.id, label: member.name })).sort(byLabel);
}
