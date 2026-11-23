import type { RouteObject } from "react-router-dom";
import type { RouteHandle } from "@shared/lib/route-handle";
import { RequirePermission } from "@modules/auth";
import { LessonDetailPage } from "./pages/LessonDetailPage";
import { LessonsCalendarPage } from "./pages/LessonsCalendarPage";
import { LessonsPage } from "./pages/LessonsPage";

export const lessonsRoutes: RouteObject[] = [
  {
    path: "lessons",
    handle: { title: "common:nav.lessons" } satisfies RouteHandle,
    element: <RequirePermission permission="lessons.view" />,
    children: [
      { index: true, element: <LessonsPage /> },
      {
        path: "calendar",
        handle: { title: "common:nav.calendar" } satisfies RouteHandle,
        element: <LessonsCalendarPage />,
      },
      // The static `calendar` wins over `:lessonId` when React Router ranks the two.
      {
        path: ":lessonId",
        handle: { title: "lessons:detail.routeTitle" } satisfies RouteHandle,
        element: <LessonDetailPage />,
      },
    ],
  },
];
