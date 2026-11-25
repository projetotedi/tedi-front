/** Hours, an "h" and, optionally, the minutes in two digits from 00 to 59: "2h30", "3h", "0h45". */
const HOURS_INPUT = /^(\d{1,3})h([0-5]\d)?$/;

/**
 * The minutes of hours typed in the format of the TEDI, the same one `formatHours` writes: "2h30" is
 * 150, "3h" is 180 and "0h45" is 45. Spaces around it and a capital "H" are accepted; anything else
 * ("2:30", "150", "2h5", "2h60") is `null`. How many minutes an entry may have is the schema's to
 * say, not this.
 */
export function parseHoursInput(text: string): number | null {
  const match = HOURS_INPUT.exec(text.trim().toLowerCase());
  if (match === null) return null;

  const [, hours, minutes = "0"] = match;
  return Number(hours) * 60 + Number(minutes);
}
