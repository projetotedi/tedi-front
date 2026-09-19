import { describe, expect, it } from "vitest";

import { buildLoginPath, readReturnTo } from "../lib/return-to";

describe("buildLoginPath", () => {
  it("encodes the target path with encodeURIComponent", () => {
    expect(buildLoginPath({ pathname: "/people", search: "", hash: "" })).toBe(
      "/login?returnTo=%2Fpeople",
    );
  });

  it("preserves query and hash in the encoded target", () => {
    expect(buildLoginPath({ pathname: "/people", search: "?page=2", hash: "#top" })).toBe(
      `/login?returnTo=${encodeURIComponent("/people?page=2#top")}`,
    );
  });

  it("appends reason=expired when a reason is given", () => {
    expect(buildLoginPath({ pathname: "/people", search: "", hash: "" }, "expired")).toBe(
      "/login?returnTo=%2Fpeople&reason=expired",
    );
  });

  it("never nests returnTo when already on /login", () => {
    expect(buildLoginPath({ pathname: "/login", search: "?returnTo=%2Fpeople", hash: "" })).toBe(
      "/login",
    );
  });

  it("never nests returnTo when already on /login, keeping reason", () => {
    expect(buildLoginPath({ pathname: "/login", search: "", hash: "" }, "expired")).toBe(
      "/login?reason=expired",
    );
  });
});

describe("readReturnTo", () => {
  it("returns / when returnTo is absent", () => {
    expect(readReturnTo("")).toBe("/");
  });

  it("returns / when returnTo is an empty string", () => {
    expect(readReturnTo("?returnTo=")).toBe("/");
  });

  it("returns the decoded internal path when returnTo is valid", () => {
    expect(readReturnTo("?returnTo=%2Fpeople")).toBe("/people");
  });

  it("rejects a protocol-relative external target (//evil.com)", () => {
    expect(readReturnTo(`?returnTo=${encodeURIComponent("//evil.com")}`)).toBe("/");
  });

  it("rejects an absolute external target (https://evil.com)", () => {
    expect(readReturnTo(`?returnTo=${encodeURIComponent("https://evil.com")}`)).toBe("/");
  });

  it("rejects a target that does not start with a single slash", () => {
    expect(readReturnTo(`?returnTo=${encodeURIComponent("evil.com")}`)).toBe("/");
  });
});
