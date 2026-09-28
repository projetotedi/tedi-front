import { describe, expect, it } from "vitest";

import { getPageItems } from "../pagination";

describe("getPageItems", () => {
  it("lists a single page", () => {
    expect(getPageItems(1, 1)).toEqual([1]);
  });

  it("lists every page when there are 3", () => {
    expect(getPageItems(1, 3)).toEqual([1, 2, 3]);
  });

  it("lists every page when there are exactly 7", () => {
    expect(getPageItems(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(getPageItems(7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("collapses the tail on the first page of 10", () => {
    expect(getPageItems(1, 10)).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 10]);
  });

  it("keeps the same items on the first pages until the current one leaves the head", () => {
    expect(getPageItems(3, 10)).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 10]);
  });

  it("collapses both sides on a middle page", () => {
    expect(getPageItems(5, 10)).toEqual([1, "ellipsis-start", 4, 5, 6, "ellipsis-end", 10]);
  });

  it("collapses the head on the last page of 10", () => {
    expect(getPageItems(10, 10)).toEqual([1, "ellipsis-start", 6, 7, 8, 9, 10]);
  });

  it("always returns 7 items when there are more than 7 pages", () => {
    for (let page = 1; page <= 20; page += 1) {
      expect(getPageItems(page, 20)).toHaveLength(7);
    }
  });

  it("always includes the first page, the last page and the current one", () => {
    for (let page = 1; page <= 20; page += 1) {
      const items = getPageItems(page, 20);
      expect(items).toContain(1);
      expect(items).toContain(20);
      expect(items).toContain(page);
    }
  });
});
