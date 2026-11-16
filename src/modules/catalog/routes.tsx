import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";
import type { RouteHandle } from "@shared/lib/route-handle";
import { RequirePermission } from "@modules/auth";
import { CourseDetailPage } from "./pages/CourseDetailPage";
import { LessonPlanDetailPage } from "./pages/LessonPlanDetailPage";
import { LessonPlansPage } from "./pages/LessonPlansPage";

/**
 * What the screens of the catalog take from other modules. `catalog` never imports another module
 * (a module is a closed box), so what one of its screens shows that belongs to another is a slot:
 * the composition in `app/` (`catalog-slots.tsx`) fills it and gives the routes to the router.
 */
export interface CatalogRouteSlots {
  /**
   * The card "Turmas deste curso" of the course screen. The classes are the data of the `classes`
   * module, so this module only says where the card goes and which course it is for.
   */
  renderCourseClasses: (courseId: string) => ReactNode;
}

export function createCatalogRoutes(slots: CatalogRouteSlots): RouteObject[] {
  return [
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
    // yet, so this one has no menu item. It is reached from "Onde este plano é usado" and from the
    // prerequisites of another course.
    {
      path: "courses/:courseId",
      handle: { title: "catalog:course.routeTitle" } satisfies RouteHandle,
      element: (
        <RequirePermission permission="catalog.view">
          <CourseDetailPage renderCourseClasses={slots.renderCourseClasses} />
        </RequirePermission>
      ),
    },
  ];
}
