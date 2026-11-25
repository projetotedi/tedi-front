/**
 * The classes of the color of an event of the calendar, one pair (background and text) for each of
 * the eight color slots the API gives a class (`class.colorIndex`, 0 to 7). The names are written
 * out in full, never built with the index: Tailwind only creates the classes it finds as literal
 * text in the source. The colors themselves, with the measured contrast of each pair, are the
 * `--color-tedi-calendar-event-N` of `src/index.css`.
 */
const CALENDAR_EVENT_CLASSES = [
  "bg-tedi-calendar-event-0 text-tedi-calendar-event-0-foreground",
  "bg-tedi-calendar-event-1 text-tedi-calendar-event-1-foreground",
  "bg-tedi-calendar-event-2 text-tedi-calendar-event-2-foreground",
  "bg-tedi-calendar-event-3 text-tedi-calendar-event-3-foreground",
  "bg-tedi-calendar-event-4 text-tedi-calendar-event-4-foreground",
  "bg-tedi-calendar-event-5 text-tedi-calendar-event-5-foreground",
  "bg-tedi-calendar-event-6 text-tedi-calendar-event-6-foreground",
  "bg-tedi-calendar-event-7 text-tedi-calendar-event-7-foreground",
] as const;

/**
 * The color classes of the events of a class. A slot out of 0 to 7, or one that is not a whole
 * number, is the first color: an event is always drawn, even if the API sent something the contract
 * does not allow.
 */
export function calendarEventClasses(colorIndex: number): string {
  const isSlot =
    Number.isInteger(colorIndex) && colorIndex >= 0 && colorIndex < CALENDAR_EVENT_CLASSES.length;

  return CALENDAR_EVENT_CLASSES[isSlot ? colorIndex : 0];
}
