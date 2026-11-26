export const RollCallStatus = { present: "present", absent: "absent" } as const;
export type RollCallStatus = (typeof RollCallStatus)[keyof typeof RollCallStatus];

export interface RollCallRow {
  key: string;
  name: string;
  detail: string;
  status: RollCallStatus | null;
  isJustified: boolean;
  signedBy: string | null;
  signedAt: string | null;
  canSign: boolean;
  isSelf: boolean;
  onCorrect?: () => void;
  onJustify?: () => void;
}

export interface RollCallEntry {
  key: string;
  status: RollCallStatus;
}

export function isPendingRow(row: RollCallRow): boolean {
  return row.status === null && row.canSign;
}

export const ATTENDANCE_CARD_ID = "lesson-attendance";

export const MOBILE_QUERY = "(max-width: 47.99rem)";

export function focusAttendance(): void {
  document.getElementById(ATTENDANCE_CARD_ID)?.focus({ preventScroll: true });
}

export function scrollToAttendance(): void {
  document.getElementById(ATTENDANCE_CARD_ID)?.scrollIntoView?.({ block: "start" });
  focusAttendance();
}
