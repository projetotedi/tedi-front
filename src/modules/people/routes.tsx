import type { RouteObject } from "react-router-dom";

import { RequirePermission } from "@modules/auth";
import type { RouteHandle } from "@shared/lib/route-handle";

import { MemberDetailPage } from "./pages/MemberDetailPage";
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
  // The screen of a member, opened from the row of `/members` (the list of `auth`, which links to
  // `memberDetailPath` of `auth/lib/member-path.ts`: that path has to match this one, and a test of
  // `app/` proves it). It has no menu item of its own: the sidebar marks "Membros" by the longest
  // matching path. The topbar title is the static "Membro" (the route only has a `handle`), and the
  // name of the member is in the trail of the page. The guard is `members.view`; the scope of the
  // member (a director only opens the ones of his department) is the 403 `FORBIDDEN_SCOPE` that the
  // page shows as the page of no access.
  {
    path: "members/:memberId",
    handle: { title: "people:member.routeTitle" } satisfies RouteHandle,
    element: (
      <RequirePermission permission="members.view">
        <MemberDetailPage />
      </RequirePermission>
    ),
  },
];
