import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

// jsdom does not implement ResizeObserver. HeroUI's ScrollShadow (used inside
// shared/ui Tabs, via Tabs.ListContainer) observes its container with it on mount;
// without a stub, any test that renders Tabs throws. The tests only exercise
// behaviour (selection, focus), never the scroll-shadow visuals, so a no-op is enough.
class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub;
