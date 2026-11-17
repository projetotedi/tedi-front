import { AssignmentRole, AssignmentSource, AssignmentStatus } from "@api/generated/model";
import type { BadgeProps } from "@shared/ui";

/**
 * The key of the label of each role under `role`, in the `assignments` namespace. The labels are
 * neutral ("Professor(a)", "Monitor(a)"): the Figma writes them in the feminine on the screens of
 * the member and in the masculine in the form, and a person of any gender can hold either role.
 */
export const ASSIGNMENT_ROLE_LABEL_KEYS = {
  [AssignmentRole.teacher]: "role.teacher",
  [AssignmentRole.monitor]: "role.monitor",
} as const satisfies Record<AssignmentRole, string>;

const ASSIGNMENT_STATUS_LABEL_KEYS = {
  [AssignmentStatus.pending]: "status.pending",
  [AssignmentStatus.confirmed]: "status.confirmed",
  [AssignmentStatus.declined]: "status.declined",
  [AssignmentStatus.cancelled]: "status.cancelled",
} as const satisfies Record<AssignmentStatus, string>;

/**
 * The key of the label of an assignment under `status`. A pending assignment that came from an
 * application is not "Pendente" but "Inscrita": the member asked for the place and waits for the
 * answer, which is what the Figma shows. A pending one that a coordinator made (`direct`) waits for
 * a confirmation of its own, so it stays "Pendente".
 */
export function assignmentStatusLabelKey(
  status: AssignmentStatus,
  source: AssignmentSource,
): string {
  if (status === AssignmentStatus.pending && source === AssignmentSource.application) {
    return "status.applied";
  }

  return ASSIGNMENT_STATUS_LABEL_KEYS[status];
}

/**
 * The tone of the tag of each status, the same on every screen that shows one: confirmed is green,
 * pending (and applied) is yellow, declined is red and cancelled is quiet.
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

/** The tone of the tag of each role: the teacher is blue and the monitor is purple, as in the Figma. */
export function assignmentRoleTone(role: AssignmentRole): BadgeProps["tone"] {
  switch (role) {
    case AssignmentRole.teacher:
      return "info";
    case AssignmentRole.monitor:
      return "highlight";
  }
}

/**
 * The statuses the form offers for a new assignment, the confirmed one first (it is the one the
 * form starts with, F5). `declined` and `cancelled` come out of a decision about an assignment that
 * exists, so the API refuses them on a new one (400 `VALIDATION_FAILED`, A8).
 */
export const ASSIGNABLE_STATUSES = [AssignmentStatus.confirmed, AssignmentStatus.pending] as const;

export type AssignableStatus = (typeof ASSIGNABLE_STATUSES)[number];
