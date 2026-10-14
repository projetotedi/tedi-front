import type { RouteObject } from "react-router-dom";
import type { RouteHandle } from "@shared/lib/route-handle";
import { RequirePermission } from "@modules/auth";
import { ClassesListPage } from "./pages/ClassesListPage";
import { ClassDetailPage } from "./pages/ClassDetailPage";

export const classesRoutes: RouteObject[] = [
  {
    path: "classes",
    handle: { title: "common:nav.classes" } satisfies RouteHandle,
    element: (
      <RequirePermission permission="classes.view">
        <ClassesListPage />
      </RequirePermission>
    ),
    children: [
      {
        path: ":classId",
        element: (
          <RequirePermission permission="classes.view">
            <ClassDetailPage />
          </RequirePermission>
        ),
      },
    ],
  },
];
