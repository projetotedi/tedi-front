import type { RouteObject } from "react-router-dom";
import type { RouteHandle } from "@shared/lib/route-handle";
import { RequirePermission } from "@modules/auth";
import { LessonPlanDetailPage } from "./pages/LessonPlanDetailPage";
import { LessonPlansPage } from "./pages/LessonPlansPage";

export const catalogRoutes: RouteObject[] = [
  {
    path: "lesson-plans",
    handle: { title: "common:nav.lessonPlans" } satisfies RouteHandle,
    element: <RequirePermission permission="catalog.view" />,
    children: [
      { index: true, element: <LessonPlansPage /> },
      {
        path: ":lessonPlanId",
        handle: { title: "catalog:detail.routeTitle" } satisfies RouteHandle,
        element: <LessonPlanDetailPage />,
      },
    ],
  },
];
