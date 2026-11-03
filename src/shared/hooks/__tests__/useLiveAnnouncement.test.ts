import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLiveAnnouncement } from "../useLiveAnnouncement";

describe("useLiveAnnouncement", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const nextFrame = () =>
    act(() => {
      vi.advanceTimersByTime(20);
    });

  /** Every text the region had, in order, without the repeats that a re-render of the same text makes. */
  function renderRecording() {
    const seen: string[] = [];
    const view = renderHook(() => {
      const announcement = useLiveAnnouncement();
      if (seen.at(-1) !== announcement.message) seen.push(announcement.message);
      return announcement;
    });
    return { ...view, seen };
  }

  it("starts empty", () => {
    const { result } = renderHook(() => useLiveAnnouncement());

    expect(result.current.message).toBe("");
  });

  it("empties the region and fills it with the message one frame later", () => {
    const { result } = renderHook(() => useLiveAnnouncement());

    act(() => result.current.announce("Moved to position 2 of 4."));
    expect(result.current.message).toBe("");

    nextFrame();
    expect(result.current.message).toBe("Moved to position 2 of 4.");
  });

  it("makes the same message twice in a row a change twice: the region is emptied in between", () => {
    const { result, seen } = renderRecording();

    act(() => result.current.announce("Moved to position 2 of 4."));
    nextFrame();
    act(() => result.current.announce("Moved to position 2 of 4."));
    expect(result.current.message).toBe("");
    nextFrame();

    expect(result.current.message).toBe("Moved to position 2 of 4.");
    expect(seen).toEqual(["", "Moved to position 2 of 4.", "", "Moved to position 2 of 4."]);
  });

  it("also changes the region for a message that is different from the last one", () => {
    const { result, seen } = renderRecording();

    act(() => result.current.announce("Moved to position 2 of 4."));
    nextFrame();
    act(() => result.current.announce("Moved to position 1 of 4."));
    nextFrame();

    expect(seen).toEqual(["", "Moved to position 2 of 4.", "", "Moved to position 1 of 4."]);
  });

  it("keeps only the last message when two come in the same frame", () => {
    const { result, seen } = renderRecording();

    act(() => {
      result.current.announce("first");
      result.current.announce("second");
    });
    nextFrame();

    expect(result.current.message).toBe("second");
    expect(seen).toEqual(["", "second"]);
  });

  it("keeps announce the same function, so it can be a dependency of an effect", () => {
    const { result, rerender } = renderHook(() => useLiveAnnouncement());
    const first = result.current.announce;

    act(() => result.current.announce("something"));
    nextFrame();
    rerender();

    expect(result.current.announce).toBe(first);
  });

  it("leaves nothing scheduled when it unmounts before the frame", () => {
    const { result, unmount } = renderHook(() => useLiveAnnouncement());

    act(() => result.current.announce("too late"));
    expect(vi.getTimerCount()).toBe(1);
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
