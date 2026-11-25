import { describe, expect, it } from "vitest";

import { accessText, formatInviteDateTime } from "../lib/access-format";

describe("accessText", () => {
  it("returns a non-empty string as it is", () => {
    expect(accessText("2024RA0001")).toBe("2024RA0001");
  });

  it.each([
    ["an empty string", ""],
    ["a blank string", "   "],
    ["null", null],
    ["undefined", undefined],
    ["an object (the wrong type the generated model declares)", { value: "x" }],
    ["a number", 42],
  ])("returns null for %s", (_label, value) => {
    expect(accessText(value)).toBeNull();
  });
});

describe("formatInviteDateTime", () => {
  it("formats as dd/mm · hh:mm in pt-BR, in the given time zone", () => {
    expect(formatInviteDateTime("2026-09-22T12:00:00.000Z", "pt-BR", "America/Sao_Paulo")).toBe(
      "22/09 · 09:00",
    );
  });

  it("uses a 24-hour clock (afternoon and midnight)", () => {
    expect(formatInviteDateTime("2026-09-22T21:30:00.000Z", "pt-BR", "America/Sao_Paulo")).toBe(
      "22/09 · 18:30",
    );
    expect(formatInviteDateTime("2026-09-23T03:05:00.000Z", "pt-BR", "America/Sao_Paulo")).toBe(
      "23/09 · 00:05",
    );
  });

  it("moves to the next day when the zone is ahead of UTC", () => {
    expect(formatInviteDateTime("2026-09-22T23:00:00.000Z", "pt-BR", "Asia/Tokyo")).toBe(
      "23/09 · 08:00",
    );
  });

  it("follows the locale for the order of day and month", () => {
    expect(formatInviteDateTime("2026-09-22T12:00:00.000Z", "en-US", "America/Sao_Paulo")).toBe(
      "09/22 · 09:00",
    );
  });

  it("returns an empty string for a value that is not a date", () => {
    expect(formatInviteDateTime("not-a-date", "pt-BR", "America/Sao_Paulo")).toBe("");
  });
});
