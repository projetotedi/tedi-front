import { describe, expect, it } from "vitest";

import { isValidCpf, onlyDigits } from "../lib/cpf";

describe("onlyDigits", () => {
  it("keeps the digits and drops punctuation, spaces and letters", () => {
    expect(onlyDigits("529.982.247-25")).toBe("52998224725");
    expect(onlyDigits(" (11) 98123-4567 ")).toBe("11981234567");
    expect(onlyDigits("ab12cd3")).toBe("123");
    expect(onlyDigits("")).toBe("");
  });
});

describe("isValidCpf", () => {
  it.each(["52998224725", "11144477735", "12345678909", "39053344705"])(
    "accepts the valid CPF %s",
    (cpf) => {
      expect(isValidCpf(cpf)).toBe(true);
    },
  );

  it.each(["529.982.247-25", "529 982 247 25", " 529.982.247-25 "])(
    "accepts the CPF with its punctuation (%j)",
    (cpf) => {
      expect(isValidCpf(cpf)).toBe(true);
    },
  );

  it("rejects 10 digits", () => {
    expect(isValidCpf("5299822472")).toBe(false);
    expect(isValidCpf("529.982.247-2")).toBe(false);
  });

  it("rejects 12 digits", () => {
    expect(isValidCpf("529982247255")).toBe(false);
  });

  it("rejects an empty value", () => {
    expect(isValidCpf("")).toBe(false);
    expect(isValidCpf("   ")).toBe(false);
  });

  it("rejects a wrong first check digit and a wrong second check digit", () => {
    expect(isValidCpf("52998224735")).toBe(false);
    expect(isValidCpf("52998224726")).toBe(false);
  });

  it.each(["00000000000", "11111111111", "22222222222", "99999999999"])(
    "rejects the repeated digits %s, which satisfy the check digits",
    (cpf) => {
      expect(isValidCpf(cpf)).toBe(false);
    },
  );

  it("rejects a letter instead of dropping it, like the API", () => {
    expect(isValidCpf("5299822472a")).toBe(false);
    expect(isValidCpf("abc.982.247-25")).toBe(false);
  });

  it("rejects separators the API would not strip", () => {
    expect(isValidCpf("529/982/247-25")).toBe(false);
    expect(isValidCpf("529,982,247-25")).toBe(false);
  });
});
