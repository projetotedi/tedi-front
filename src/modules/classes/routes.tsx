import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";
import type { ClassDetailDto } from "@api/generated/model";
import type { RouteHandle } from "@shared/lib/route-handle";
import { RequirePermission } from "@modules/auth";
import { ClassesListPage } from "./pages/ClassesListPage";
import { ClassDetailPage } from "./pages/ClassDetailPage";

/**
 * What the screens of the classes take from other modules. `classes` never imports another module
 * (a module is a closed box), so what one of its screens shows that belongs to another is a slot:
 * the composition in `app/` (`classes-slots.tsx`) fills it and gives the routes to the router.
 */
export interface ClassesRouteSlots {
  /**
   * The action "+ Nova aula" of the header of the class. Lessons are the data of the `lessons`
   * module, which depends on this one, so this module only says where the action goes and which
   * class it is for. The slot decides who sees it (`lessons.manage`); the screen only asks for it
   * when the class is not archived, since an archived class is read-only (RN-27).
   */
  renderNewLessonAction: (classDetail: ClassDetailDto) => ReactNode;
}

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
              <ClassDetailPage renderNewLessonAction={slots.renderNewLessonAction} />
            </RequirePermission>
          ),
        },
      ],
    },
  ];
}
