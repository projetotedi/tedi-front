import { describe, expect, it } from "vitest";

import { findActivePath } from "../active-path";

describe("findActivePath", () => {
  it("returns the longest matching path", () => {
    const paths = ["/lessons", "/lessons/calendar"];

    expect(findActivePath(paths, "/lessons/calendar")).toBe("/lessons/calendar");
    expect(findActivePath([...paths].reverse(), "/lessons/calendar")).toBe("/lessons/calendar");
    expect(findActivePath(paths, "/lessons")).toBe("/lessons");
  });

  it("matches nested routes by segment", () => {
    expect(findActivePath(["/classes"], "/classes/abc")).toBe("/classes");
    expect(findActivePath(["/classes"], "/classes/abc/edit")).toBe("/classes");
    expect(findActivePath(["/classes"], "/classesx")).toBeNull();
    expect(findActivePath(["/classes"], "/classesx/abc")).toBeNull();
  });

  it("ignores a trailing slash", () => {
    expect(findActivePath(["/lessons", "/lessons/calendar"], "/lessons/calendar/")).toBe(
      "/lessons/calendar",
    );
    expect(findActivePath(["/classes"], "/classes/")).toBe("/classes");
  });

  it("ignores case, like the router", () => {
    expect(findActivePath(["/lessons/calendar"], "/Lessons/Calendar")).toBe("/lessons/calendar");
  });

  it("returns null when nothing matches", () => {
    expect(findActivePath(["/courses", "/classes"], "/profile")).toBeNull();
    expect(findActivePath(["/courses"], "/")).toBeNull();
    expect(findActivePath([], "/courses")).toBeNull();
  });
});
