import type { RouteObject } from "react-router-dom";

import { RequirePermission } from "@modules/auth";
import type { RouteHandle } from "@shared/lib/route-handle";

import { LessonPlansPage } from "./pages/LessonPlansPage";

export const catalogRoutes: RouteObject[] = [
  {
    path: "lesson-plans",
    handle: { title: "common:nav.lessonPlans" } satisfies RouteHandle,
    element: <RequirePermission permission="catalog.view" />,
    children: [{ index: true, element: <LessonPlansPage /> }],
  },
];
