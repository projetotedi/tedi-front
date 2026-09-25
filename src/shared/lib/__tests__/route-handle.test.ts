import { describe, expect, it } from "vitest";

import { getHeaderTitle, type RouteHandle } from "../route-handle";

describe("getHeaderTitle", () => {
  it("returns undefined when the route has no handle", () => {
    expect(getHeaderTitle(undefined)).toBeUndefined();
    expect(getHeaderTitle(null)).toBeUndefined();
  });

  it("returns undefined for a handle that is not an object", () => {
    expect(getHeaderTitle("title")).toBeUndefined();
    expect(getHeaderTitle(42)).toBeUndefined();
  });

  it("returns undefined for a handle without headerTitle", () => {
    expect(getHeaderTitle({})).toBeUndefined();
    expect(getHeaderTitle({ crumb: "Acessos" })).toBeUndefined();
  });

  it("returns undefined when headerTitle is malformed", () => {
    expect(getHeaderTitle({ headerTitle: "access.title" })).toBeUndefined();
    expect(getHeaderTitle({ headerTitle: null })).toBeUndefined();
    expect(getHeaderTitle({ headerTitle: { ns: "auth" } })).toBeUndefined();
    expect(getHeaderTitle({ headerTitle: { key: "access.title" } })).toBeUndefined();
    expect(getHeaderTitle({ headerTitle: { ns: 1, key: "access.title" } })).toBeUndefined();
  });

  it("returns the namespace and key of a valid headerTitle", () => {
    const handle = { headerTitle: { ns: "auth", key: "access.title" } } satisfies RouteHandle;

    expect(getHeaderTitle(handle)).toEqual({ ns: "auth", key: "access.title" });
  });

  it("ignores extra fields on the handle", () => {
    expect(
      getHeaderTitle({ headerTitle: { ns: "auth", key: "access.title" }, other: true }),
    ).toEqual({ ns: "auth", key: "access.title" });
  });
});
