import { ClassStatus } from "@api/generated/model";
import type { BadgeProps } from "@shared/ui";

/**
 * The tone of the tag of each status of a class. The text always says the status, the color only
 * reinforces it. An archived class keeps its status (RF-034, RN-27), so archiving has a tag of its
 * own and does not change this one.
 */
export const CLASS_STATUS_TONE: Record<ClassStatus, BadgeProps["tone"]> = {
  [ClassStatus.planned]: "info",
  [ClassStatus.in_progress]: "success",
  [ClassStatus.completed]: "neutral",
  [ClassStatus.cancelled]: "danger",
};
