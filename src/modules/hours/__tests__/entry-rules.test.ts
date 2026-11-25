import { describe, expect, it } from "vitest";

import type { HourEntryOrigin, HourEntryStatus } from "@api/generated/model";

import { canRemoveEntry } from "../lib/entry-rules";
import { buildEntry } from "./entries-handlers";

const CASES: { status: HourEntryStatus; origin: HourEntryOrigin; removable: boolean }[] = [
  { status: "pending", origin: "manual", removable: true },
  { status: "pending", origin: "on_behalf", removable: true },
  { status: "pending", origin: "attendance", removable: false },
  ...(["approved", "adjusted", "rejected"] as const).flatMap((status) =>
    (["manual", "on_behalf", "attendance"] as const).map((origin) => ({
      status,
      origin,
      removable: false,
    })),
  ),
];

describe("canRemoveEntry", () => {
  it.each(CASES)(
    "a $status entry with origin $origin is removable: $removable",
    ({ status, origin, removable }) => {
      expect(canRemoveEntry(buildEntry({ status, origin }))).toBe(removable);
    },
  );
});
