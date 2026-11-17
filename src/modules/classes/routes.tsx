import type { RouteObject } from "react-router-dom";
import type { RouteHandle } from "@shared/lib/route-handle";
import { RequirePermission } from "@modules/auth";
import { ClassesListPage } from "./pages/ClassesListPage";
import { ClassDetailPage, type ClassDetailSlots } from "./pages/ClassDetailPage";

/**
 * What the screens of the classes take from other modules. `classes` never imports another module
 * (a module is a closed box), so what one of its screens shows that belongs to another is a slot:
 * the composition in `app/` (`classes-slots.tsx`) fills it and gives the routes to the router.
 *
 * - `renderLessonActions(classDetail)`: the actions about the lessons of the class, in the header
 *   of its screen: Gerar aulas (GUS-157) and + Nova aula (GUS-152). The lessons are the
 *   data of the `lessons` module, so this module only says where they go and which class they are
 *   for. It gets the whole detail because the buttons depend on what the class is (its course,
 *   its first day, whether it is archived).
 * - `renderClassLessons(classId)`: the card "Aulas da turma" of the screen of the class, which is
 *   the `lessons` module's.
 */
export type ClassesRouteSlots = ClassDetailSlots;

export function createClassesRoutes(slots: ClassesRouteSlots): RouteObject[] {
  return [
    {
      path: "classes",
      handle: { title: "common:nav.classes" } satisfies RouteHandle,
      element: <RequirePermission permission="classes.view" />,
      children: [
        { index: true, element: <ClassesListPage /> },
        {
          path: ":classId",
          handle: { title: "classes:detail.routeTitle" } satisfies RouteHandle,
          element: (
            <RequirePermission permission="classes.view">
              <ClassDetailPage
                renderLessonActions={slots.renderLessonActions}
                renderClassLessons={slots.renderClassLessons}
              />
            </RequirePermission>
          ),
        },
      ],
    },
  ];
}
