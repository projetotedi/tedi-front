import type { ChipProps } from "@shared/ui";

import type { AccountStatus, EntryStatus } from "../mocks/profile.mock";

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
