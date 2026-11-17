import type { TFunction } from "i18next";

import {
  AssignmentRole,
  AssignmentStatus,
  type AssignmentLessonResponseDto,
} from "@api/generated/model";
import type { BadgeProps } from "@shared/ui";

/** The key of the label of each role, under `roles`: "Professor(a)" and "Monitor(a)". */
export const ROLE_LABEL_KEYS = {
  [AssignmentRole.teacher]: "roles.teacher",
  [AssignmentRole.monitor]: "roles.monitor",
} as const satisfies Record<AssignmentRole, string>;

/**
 * The role inside a sentence ("como monitor(a)"), in lower case. The API has no gender for the
 * person, so the text keeps both forms instead of guessing one.
 */
export const ROLE_INLINE_KEYS = {
  [AssignmentRole.teacher]: "rolesInline.teacher",
  [AssignmentRole.monitor]: "rolesInline.monitor",
} as const satisfies Record<AssignmentRole, string>;

/** The order the roles are offered in when applying: Monitor(a) first, as in the Figma. */
export const APPLY_ROLE_ORDER = [AssignmentRole.monitor, AssignmentRole.teacher] as const;

/** The key of the label of each status of an assignment, under `assignmentStatus`. */
export const ASSIGNMENT_STATUS_LABEL_KEYS = {
  [AssignmentStatus.pending]: "assignmentStatus.pending",
  [AssignmentStatus.confirmed]: "assignmentStatus.confirmed",
  [AssignmentStatus.declined]: "assignmentStatus.declined",
  [AssignmentStatus.cancelled]: "assignmentStatus.cancelled",
} as const satisfies Record<AssignmentStatus, string>;

/**
 * The tone of the tag of each status, the same on every screen that shows one: confirmed is green,
 * what waits for a decision is yellow, a refusal is red and a cancellation is quiet.
 */
export function assignmentStatusTone(status: AssignmentStatus): BadgeProps["tone"] {
  switch (status) {
    case AssignmentStatus.confirmed:
      return "success";
    case AssignmentStatus.pending:
      return "warning";
    case AssignmentStatus.declined:
      return "danger";
    case AssignmentStatus.cancelled:
      return "neutral";
  }
}

/**
 * The name of a lesson as the screens of this module show it: "Aula 3 · Arquivos e pastas", the
 * place of its plan in the sequence of the course and its title. A lesson on its own has no place,
 * so it shows only the title.
 */
export function lessonLabel(
  lesson: Pick<AssignmentLessonResponseDto, "title" | "sequenceOrder">,
  t: TFunction<"assignments">,
): string {
  if (lesson.sequenceOrder === null) return lesson.title;
  return t("lessonLabel", { order: lesson.sequenceOrder, title: lesson.title });
}
