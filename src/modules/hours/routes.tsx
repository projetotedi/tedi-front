import type { RouteObject } from "react-router-dom";

import { RequirePermission } from "@modules/auth";
import type { RouteHandle } from "@shared/lib/route-handle";

import { HoursPage } from "./pages/HoursPage";
import { HoursReviewPage } from "./pages/HoursReviewPage";

/** The routes of the bank of hours, with the same permission as their menu items (decision 18). */
export const hoursRoutes: RouteObject[] = [
  {
    path: "hours",
    handle: { title: "common:nav.hours" } satisfies RouteHandle,
    element: (
      <RequirePermission permission="hours.viewOthers">
        <HoursPage />
      </RequirePermission>
    ),
  },
  {
    path: "hours/review",
    handle: { title: "common:nav.hoursReview" } satisfies RouteHandle,
    element: (
      <RequirePermission permission="hours.review">
        <HoursReviewPage />
      </RequirePermission>
    ),
  },
];
