import { HourEntryOrigin, HourEntryStatus, type HourEntryResponseDto } from "@api/generated/model";

/**
 * Whether the person can remove the entry: only while it waits for validation, and only when it was
 * not created by the attendance of a lesson. The API refuses the rest (409 `ENTRY_NOT_PENDING` and
 * `ATTENDANCE_ENTRY_NOT_REMOVABLE`, whatever the status), so the screen does not offer it.
 */
export function canRemoveEntry(entry: HourEntryResponseDto): boolean {
  return entry.status === HourEntryStatus.pending && entry.origin !== HourEntryOrigin.attendance;
}
