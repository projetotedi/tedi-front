import type { RouteObject } from "react-router-dom";
import type { RouteHandle } from "@shared/lib/route-handle";
import { RequirePermission } from "@modules/auth";
import { LessonsCalendarPage } from "./pages/LessonsCalendarPage";
import { LessonsComingSoonPage } from "./pages/LessonsComingSoonPage";
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
      // Where a row of the list and an event of the calendar go (`lessonDetailPath`). The screen of
      // the lesson is the next task (GUS-156), which swaps this element for it; until then the
      // click lands on the "Em breve" page, with the title of the group ("Aulas") in the topbar.
      { path: ":lessonId", element: <LessonsComingSoonPage /> },
    ],
  },
];
