import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { saveFile } from "../save-file";

describe("saveFile", () => {
  const createObjectURL = vi.fn(() => "blob:hours");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom has neither of the two.
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
  });

  it("downloads the file with the given name through a link that leaves the page, and frees the URL afterwards", () => {
    const clicked: Array<{ href: string; download: string; isInPage: boolean }> = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        clicked.push({ href: this.href, download: this.download, isInPage: this.isConnected });
      },
    );
    const file = new Blob(["data;membro"], { type: "text/csv" });

    saveFile(file, "hours_2026-03-01_2026-03-31.csv");

    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(clicked).toEqual([
      { href: "blob:hours", download: "hours_2026-03-01_2026-03-31.csv", isInPage: true },
    ]);
    expect(document.querySelector("a[download]")).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:hours");
  });
});
