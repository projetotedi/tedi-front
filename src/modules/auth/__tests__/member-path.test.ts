import { describe, expect, it } from "vitest";

import { memberDetailPath } from "../lib/member-path";

describe("memberDetailPath", () => {
  it("is /members/ followed by the id", () => {
    expect(memberDetailPath("01952ef7-0000-7000-8000-0000000000c1")).toBe(
      "/members/01952ef7-0000-7000-8000-0000000000c1",
    );
  });

  it("encodes what would break the path or turn it into another one", () => {
    expect(memberDetailPath("a/b")).toBe("/members/a%2Fb");
    expect(memberDetailPath("a?b#c")).toBe("/members/a%3Fb%23c");
    expect(memberDetailPath("../hours")).toBe("/members/..%2Fhours");
  });
});
