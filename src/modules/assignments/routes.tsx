import type { RouteObject } from "react-router-dom";

import { RequirePermission } from "@modules/auth";
import type { RouteHandle } from "@shared/lib/route-handle";

import { MyLessonsPage } from "./pages/MyLessonsPage";

export const assignmentsRoutes: RouteObject[] = [
  {
    path: "my-lessons",
    handle: { title: "common:nav.myLessons" } satisfies RouteHandle,
    element: (
      <RequirePermission permission="assignments.manageOwn">
        <MyLessonsPage />
      </RequirePermission>
    ),
  },
];
