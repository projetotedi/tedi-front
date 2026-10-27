import type { RouteObject } from "react-router-dom";
import type { RouteHandle } from "@shared/lib/route-handle";
import { RequirePermission } from "@modules/auth";
import { ComingSoonPage } from "@app/pages/ComingSoonPage";
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
        handle: { title: "catalog:detailComingSoon" } satisfies RouteHandle,
        element: <ComingSoonPage />,
      },
    ],
  },
];
