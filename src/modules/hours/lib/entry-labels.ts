import { HourEntryCategory, type HourEntryStatus } from "@api/generated/model";

/** The label of each category of the contract, as a key of the `hours` namespace. */
export const ENTRY_CATEGORY_LABEL_KEYS = {
  lesson: "entries.categories.lesson",
  planning: "entries.categories.planning",
  event: "entries.categories.event",
  management: "entries.categories.management",
  meeting: "entries.categories.meeting",
  support: "entries.categories.support",
  other: "entries.categories.other",
} as const satisfies Record<HourEntryCategory, string>;

/** The label of each status of an entry, as a key of the `hours` namespace. */
export const ENTRY_STATUS_LABEL_KEYS = {
  pending: "entries.status.pending",
  approved: "entries.status.approved",
  adjusted: "entries.status.adjusted",
  rejected: "entries.status.rejected",
} as const satisfies Record<HourEntryStatus, string>;

/**
 * The categories a person logs by hand, in the order of F7.7. `lesson` is not one of them: the API
 * refuses it (400 `VALIDATION_FAILED`), because the hours of a lesson only come from the confirmed
 * attendance (RN-03). "Aula" is still a label, for the entries the attendance creates.
 */
export const LOGGABLE_CATEGORIES = [
  "planning",
  "event",
  "management",
  "meeting",
  "support",
  "other",
] as const satisfies readonly HourEntryCategory[];

export type LoggableCategory = (typeof LOGGABLE_CATEGORIES)[number];

/** The category a value of the select stands for, or `null` when it is not one that can be logged. */
export function toLoggableCategory(value: string): LoggableCategory | null {
  return LOGGABLE_CATEGORIES.find((category) => category === value) ?? null;
}

/** The categories in the order of the contract: what breaks a tie between two of them. */
export const CATEGORY_ORDER: readonly HourEntryCategory[] = Object.values(HourEntryCategory);

/** The shape of the pills of the hours (the one of the shared `Badge`). */
export const ENTRY_TAG_SHAPE =
  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium";

/**
 * The colors of the pill of each status, the pairs of the Figma ("tedi-status-*"): Aprovado green,
 * Ajustado and Pendente yellow, Rejeitado red. The word always says the status, so the color is never
 * the only cue. They are not tones of the shared `Badge`, whose yellow and red are other shades:
 * changing it would change every tag of the app.
 */
export const ENTRY_STATUS_TAG_CLASSES = {
  approved: "bg-tedi-badge-success text-tedi-badge-success-foreground",
  adjusted: "bg-tedi-warning text-tedi-status-warning-foreground",
  pending: "bg-tedi-warning text-tedi-status-warning-foreground",
  rejected: "bg-tedi-status-danger text-tedi-status-danger-foreground",
} as const satisfies Record<HourEntryStatus, string>;
