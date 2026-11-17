import { ClassStatus } from "@api/generated/model";
import type { BadgeProps } from "@shared/ui";

/** The key of the label of each status in the `classes` namespace (`planned`, `inProgress`...). */
export const CLASS_STATUS_LABEL_KEYS = {
  [ClassStatus.planned]: "planned",
  [ClassStatus.in_progress]: "inProgress",
  [ClassStatus.completed]: "completed",
  [ClassStatus.cancelled]: "cancelled",
} as const satisfies Record<ClassStatus, string>;

/** The tone of the tag of each status, the same on every screen that shows one. */
export function classStatusTone(status: ClassStatus): BadgeProps["tone"] {
  switch (status) {
    case ClassStatus.planned:
      return "warning";
    case ClassStatus.in_progress:
      return "info";
    case ClassStatus.completed:
      return "neutral";
    case ClassStatus.cancelled:
      return "danger";
  }
}
