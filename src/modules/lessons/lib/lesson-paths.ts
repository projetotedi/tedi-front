/**
 * The path of the screen of one lesson. Every link and click that opens a lesson (the row of the
 * list, an event of the calendar) goes through here, so the day the detail has its own route
 * (GUS-156) this is the only place that has to know where it is.
 */
export function lessonDetailPath(lessonId: string): string {
  return `/lessons/${lessonId}`;
}
