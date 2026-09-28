import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebounce } from "../useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderDebounce(initial: string, delayMs = 400) {
    return renderHook(({ value }) => useDebounce(value, delayMs), {
      initialProps: { value: initial },
    });
  }

  it("returns the initial value right away", () => {
    const { result } = renderDebounce("a");

    expect(result.current).toBe("a");
  });

  it("only updates after the delay has passed", () => {
    const { result, rerender } = renderDebounce("a");

    rerender({ value: "ab" });
    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("ab");
  });

  it("restarts the wait on every change and keeps only the last value", () => {
    const { result, rerender } = renderDebounce("a");

    rerender({ value: "ab" });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender({ value: "abc" });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("abc");
  });

  it("does not update after unmount", () => {
    const { result, rerender, unmount } = renderDebounce("a");

    rerender({ value: "ab" });
    unmount();
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).toBe("a");
  });
});
