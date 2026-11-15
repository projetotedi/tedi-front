import { describe, expect, it } from "vitest";

import { isHttpUrl } from "../lib/url";

describe("isHttpUrl", () => {
  it.each([
    ["an https link", "https://drive.google.com/file/d/exemplo/view"],
    ["an http link", "http://example.com/term.pdf"],
  ])("accepts %s", (_label, value) => {
    expect(isHttpUrl(value)).toBe(true);
  });

  it.each([
    ["a javascript: URL", "javascript:alert(1)"],
    ["a data: URL", "data:text/html,<p>x</p>"],
    ["another scheme", "ftp://example.com/term.pdf"],
    ["a link without a scheme", "drive.google.com/x"],
    ["an empty value", ""],
  ])("rejects %s", (_label, value) => {
    expect(isHttpUrl(value)).toBe(false);
  });
});
