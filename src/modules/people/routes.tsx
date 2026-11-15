import type { RouteObject } from "react-router-dom";

import { RequirePermission } from "@modules/auth";
import type { RouteHandle } from "@shared/lib/route-handle";

import { ProfilePage } from "./pages/ProfilePage";
import { StudentDetailPage } from "./pages/StudentDetailPage";

/** Rotas autenticadas do módulo, montadas sob AppLayout em app/router.tsx. */
export const peopleRoutes: RouteObject[] = [
  {
    path: "profile",
    handle: { title: "people:profile.title" } satisfies RouteHandle,
    element: <ProfilePage />,
  },
  // Besides the "Alunos" of the prototype ("Em breve", `/students`): there is no list of students
  // yet, so this one has no menu item. The topbar title is the static "Aluno" on purpose: the name
  // and the accessibility of the student are health data (LGPD) and must not reach the tab. The
  // guard is `students.view`, the permission of that menu item, which marks "Alunos" in the
  // sidebar by the longest matching path.
  {
    path: "students/:studentId",
    handle: { title: "people:student.routeTitle" } satisfies RouteHandle,
    element: (
      <RequirePermission permission="students.view">
        <StudentDetailPage />
      </RequirePermission>
    ),
  },
];
