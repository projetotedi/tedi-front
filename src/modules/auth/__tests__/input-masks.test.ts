import { describe, expect, it } from "vitest";

import { caretAfterDigits, formatCpf, formatPhone } from "../lib/input-masks";

describe("formatCpf", () => {
  it.each([
    ["", ""],
    ["5", "5"],
    ["529", "529"],
    ["5299", "529.9"],
    ["529982", "529.982"],
    ["5299822", "529.982.2"],
    ["529982247", "529.982.247"],
    ["5299822472", "529.982.247-2"],
    ["52998224725", "529.982.247-25"],
  ])("formats %j as %j while it is typed", (input, expected) => {
    expect(formatCpf(input)).toBe(expected);
  });

  it("returns its own output unchanged", () => {
    expect(formatCpf("529.982.247-25")).toBe("529.982.247-25");
    expect(formatCpf("529.9")).toBe("529.9");
  });

  it("takes a paste with another punctuation or with spaces around it", () => {
    expect(formatCpf(" 529 982 247 25 ")).toBe("529.982.247-25");
    expect(formatCpf("529-982-247.25")).toBe("529.982.247-25");
  });

  it("drops what is not a digit", () => {
    expect(formatCpf("ab529cd")).toBe("529");
    expect(formatCpf("a")).toBe("");
  });

  it("cuts at the 11th digit", () => {
    expect(formatCpf("5299822472599999")).toBe("529.982.247-25");
  });

  it("drops the separator when the digit before it is erased", () => {
    expect(formatCpf("529.")).toBe("529");
    expect(formatCpf("529.982.")).toBe("529.982");
  });
});

describe("formatPhone", () => {
  it.each([
    ["", ""],
    ["1", "(1"],
    ["11", "(11"],
    ["119", "(11) 9"],
    ["11981", "(11) 981"],
    ["1198123", "(11) 9812-3"],
    ["119812345", "(11) 9812-345"],
    ["1123456789", "(11) 2345-6789"],
    ["11981234567", "(11) 98123-4567"],
  ])("formats %j as %j while it is typed", (input, expected) => {
    expect(formatPhone(input)).toBe(expected);
  });

  it("moves the hyphen when the 11th digit makes it a mobile number", () => {
    expect(formatPhone("1198123456")).toBe("(11) 9812-3456");
    expect(formatPhone("11981234567")).toBe("(11) 98123-4567");
  });

  it("returns its own output unchanged", () => {
    expect(formatPhone("(11) 98123-4567")).toBe("(11) 98123-4567");
    expect(formatPhone("(11) 2345-6789")).toBe("(11) 2345-6789");
    expect(formatPhone("(11")).toBe("(11");
  });

  it("drops the parenthesis and the space when the digits before them are erased", () => {
    expect(formatPhone("(11) ")).toBe("(11");
    expect(formatPhone("(1")).toBe("(1");
    expect(formatPhone("(")).toBe("");
  });

  it("cuts at the 11th digit", () => {
    expect(formatPhone("1198123456789")).toBe("(11) 98123-4567");
  });

  it("drops what is not a digit", () => {
    expect(formatPhone("tel 11 98123-4567")).toBe("(11) 98123-4567");
  });

  it("drops the Brazil country code of a pasted number instead of reading it as the area code", () => {
    expect(formatPhone("+55 11 98123-4567")).toBe("(11) 98123-4567");
    expect(formatPhone("+5511981234567")).toBe("(11) 98123-4567");
    expect(formatPhone("5511981234567")).toBe("(11) 98123-4567");
    expect(formatPhone("551123456789")).toBe("(11) 2345-6789");
  });

  it("keeps an area code of 55 typed without a country code", () => {
    expect(formatPhone("55981234567")).toBe("(55) 98123-4567");
    expect(formatPhone("5598")).toBe("(55) 98");
  });
});

describe("caretAfterDigits", () => {
  it("returns the position right after the n-th digit", () => {
    expect(caretAfterDigits("529.982.247-25", 3)).toBe(3);
    expect(caretAfterDigits("529.982.247-25", 4)).toBe(5);
    expect(caretAfterDigits("529.982.247-25", 11)).toBe(14);
  });

  it("skips the punctuation of a phone", () => {
    expect(caretAfterDigits("(11) 98123-4567", 1)).toBe(2);
    expect(caretAfterDigits("(11) 98123-4567", 3)).toBe(6);
    expect(caretAfterDigits("(11) 98123-4567", 7)).toBe(10);
    expect(caretAfterDigits("(11) 98123-4567", 8)).toBe(12);
  });

  it("goes to the start when there is no digit before the caret", () => {
    expect(caretAfterDigits("529.982", 0)).toBe(0);
    expect(caretAfterDigits("529.982", -1)).toBe(0);
  });

  it("goes to the end when the text has fewer digits than asked", () => {
    expect(caretAfterDigits("529.9", 9)).toBe(5);
    expect(caretAfterDigits("", 2)).toBe(0);
  });
});
