/**
 * `true` only for an absolute `http:` or `https:` URL. The registration is typed by people, so a
 * value such as `javascript:...` must never reach an `href`.
 */
export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
