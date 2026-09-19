import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SLOW_NOTICE_DELAY_MS, useSlowRequestNotice } from "../hooks/useSlowRequestNotice";

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("useSlowRequestNotice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits 3 seconds before turning on", () => {
    expect(SLOW_NOTICE_DELAY_MS).toBe(3000);
    const { result } = renderHook(() => useSlowRequestNotice(true));

    expect(result.current).toBe(false);
    advance(SLOW_NOTICE_DELAY_MS - 1);
    expect(result.current).toBe(false);
    advance(1);
    expect(result.current).toBe(true);
  });

  it("turns off as soon as the request settles", () => {
    const { result, rerender } = renderHook(({ isPending }) => useSlowRequestNotice(isPending), {
      initialProps: { isPending: true },
    });
    advance(SLOW_NOTICE_DELAY_MS);
    expect(result.current).toBe(true);

    rerender({ isPending: false });

    expect(result.current).toBe(false);
  });

  it("stays off while there is no pending request", () => {
    const { result } = renderHook(() => useSlowRequestNotice(false));

    expect(vi.getTimerCount()).toBe(0);
    advance(SLOW_NOTICE_DELAY_MS * 3);
    expect(result.current).toBe(false);
  });

  it("does not turn on when the response arrives before the delay", () => {
    const { result, rerender } = renderHook(({ isPending }) => useSlowRequestNotice(isPending), {
      initialProps: { isPending: true },
    });
    advance(SLOW_NOTICE_DELAY_MS - 1);

    rerender({ isPending: false });
    advance(SLOW_NOTICE_DELAY_MS);

    expect(result.current).toBe(false);
  });

  it("counts the delay again from zero on the next request", () => {
    const { result, rerender } = renderHook(({ isPending }) => useSlowRequestNotice(isPending), {
      initialProps: { isPending: true },
    });
    advance(SLOW_NOTICE_DELAY_MS);
    rerender({ isPending: false });

    rerender({ isPending: true });
    expect(result.current).toBe(false);
    advance(SLOW_NOTICE_DELAY_MS - 1);
    expect(result.current).toBe(false);
    advance(1);
    expect(result.current).toBe(true);
  });

  it("honors a custom delay", () => {
    const { result } = renderHook(() => useSlowRequestNotice(true, 500));

    advance(499);
    expect(result.current).toBe(false);
    advance(1);
    expect(result.current).toBe(true);
  });

  it("clears the timer when it unmounts while waiting", () => {
    const { unmount } = renderHook(() => useSlowRequestNotice(true));
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
