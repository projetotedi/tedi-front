import { describe, expect, it } from "vitest";

import { findRouteTitle } from "../route-handle";

describe("findRouteTitle", () => {
  it("returns the title of the innermost route that declares one", () => {
    const matches = [
      { handle: undefined },
      { handle: { title: "common:app.name" } },
      { handle: { title: "people:profile.title" } },
      { handle: undefined },
    ];

    expect(findRouteTitle(matches)).toBe("people:profile.title");
  });

  it("returns null when no route declares a title", () => {
    expect(findRouteTitle([{ handle: undefined }, { handle: { other: 1 } }])).toBeNull();
  });
});
