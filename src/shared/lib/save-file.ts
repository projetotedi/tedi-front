/** How long the URL of the blob lives after the click: the browser starts reading it in that time. */
const REVOKE_DELAY_MS = 1000;

/**
 * Hands `file` to the browser as a download called `fileName`, through a temporary link that leaves
 * the page right after the click. Nothing here knows what the file is.
 */
export function saveFile(file: Blob, fileName: string): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
