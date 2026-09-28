import type { ChipProps } from "@shared/ui";

import type { AccountStatus, CategoryStatus, EntryStatus } from "../mocks/profile.mock";

type ChipColor = NonNullable<ChipProps["color"]>;

export const ACCOUNT_STATUS_COLOR: Record<AccountStatus, ChipColor> = {
  active: "success",
  inactive: "default",
};

export const ENTRY_STATUS_COLOR: Record<EntryStatus, ChipColor> = {
  approved: "success",
  adjusted: "accent",
  pending: "warning",
  rejected: "danger",
};

export const CATEGORY_STATUS_COLOR: Record<CategoryStatus, ChipColor> = {
  validated: "success",
  pending: "warning",
  adjusted: "accent",
};
