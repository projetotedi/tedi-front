import type { RouteObject } from "react-router-dom";
import type { RouteHandle } from "@shared/lib/route-handle";
import { RequirePermission } from "@modules/auth";
import { LessonsComingSoonPage } from "./pages/LessonsComingSoonPage";

export const lessonsRoutes: RouteObject[] = [
  {
    path: "lessons",
    handle: { title: "common:nav.lessons" } satisfies RouteHandle,
    element: <RequirePermission permission="lessons.view" />,
    children: [
      { index: true, element: <LessonsComingSoonPage /> },
      {
        path: "calendar",
        handle: { title: "common:nav.calendar" } satisfies RouteHandle,
        element: <LessonsComingSoonPage />,
      },
    ],
  },
];
