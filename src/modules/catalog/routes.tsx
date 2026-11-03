import type { RouteObject } from "react-router-dom";
import type { RouteHandle } from "@shared/lib/route-handle";
import { RequirePermission } from "@modules/auth";
import { CourseDetailPage } from "./pages/CourseDetailPage";
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
  // Besides the "Cursos" of the prototype ("Em breve", `/courses`): there is no list of courses
  // yet, so this one has no menu item. It is reached from "Onde este plano é usado".
  {
    path: "courses/:courseId",
    handle: { title: "catalog:course.routeTitle" } satisfies RouteHandle,
    element: (
      <RequirePermission permission="catalog.view">
        <CourseDetailPage />
      </RequirePermission>
    ),
  },
];
