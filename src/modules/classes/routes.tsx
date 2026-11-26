import type { RouteObject } from "react-router-dom";
import type { RouteHandle } from "@shared/lib/route-handle";
import { RequirePermission } from "@modules/auth";
import { ClassesListPage } from "./pages/ClassesListPage";
import { ClassDetailPage, type ClassDetailSlots } from "./pages/ClassDetailPage";
import { EnrollmentPage } from "./pages/EnrollmentPage";

/**
 * What the screens of the classes take from other modules. `classes` never imports another module
 * (a module is a closed box), so what one of its screens shows that belongs to another is a slot:
 * the composition in `app/` (`classes-slots.tsx`) fills it and gives the routes to the router.
 *
 * - `renderLessonActions(classDetail, classActions)`: the actions of the header of the screen of a
 *   class: Gerar aulas (GUS-157) and + Nova aula (GUS-152), which are the `lessons` module's, with
 *   Editar turma (`classActions.editClassAction`, GUS-133) between them, in the order of the Figma.
 *   It gets the whole detail because the buttons depend on what the class is (its course, its
 *   first day), and `classActions.onEditClass` for the shortcut of Gerar aulas to the form.
 * - `renderClassLessons(classId)`: the card "Aulas da turma" of the screen of the class, which is
 *   the `lessons` module's.
 *
 * The enrollment screen (GUS-138) answers on `/enrollments` (the menu, the class is picked there)
 * and on `/classes/:classId/enrollments`, with `enrollments.manage`.
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
        {
          path: ":classId/enrollments",
          handle: { title: "classes:enrollment.routeTitle" } satisfies RouteHandle,
          element: (
            <RequirePermission permission="enrollments.manage">
              <EnrollmentPage />
            </RequirePermission>
          ),
        },
      ],
    },
    {
      path: "enrollments",
      handle: { title: "classes:enrollment.routeTitle" } satisfies RouteHandle,
      element: (
        <RequirePermission permission="enrollments.manage">
          <EnrollmentPage />
        </RequirePermission>
      ),
    },
  ];
}
