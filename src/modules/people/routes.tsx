import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";

import { RequirePermission } from "@modules/auth";
import type { RouteHandle } from "@shared/lib/route-handle";

import { MemberDetailPage } from "./pages/MemberDetailPage";
import { ProfilePage } from "./pages/ProfilePage";
import { StudentDetailPage } from "./pages/StudentDetailPage";
import { StudentsPage } from "./pages/StudentsPage";

/**
 * What the screens of `people` take from other modules. `people` never imports another module (a
 * module is a closed box, and an entry of hours belongs to the person: `hours → people` in the back),
 * so what one of its screens shows that belongs to another is a slot: the composition in `app/`
 * (`people-slots.tsx`) fills it and gives the routes to the router.
 */
export interface PeopleRouteSlots {
  /**
   * The actions of other modules in the header of "Meu perfil", after "Editar meus dados" (today
   * "+ Lançar horas", of `hours`).
   */
  renderProfileActions: () => ReactNode;
  /** The numbers of the hours of the person, between the header and the columns of "Meu perfil". */
  renderProfileHoursSummary: () => ReactNode;
  /** The cards of the hours of the person, on top of the main column of "Meu perfil". */
  renderProfileHoursCards: () => ReactNode;
}

/** Rotas autenticadas do módulo, montadas sob AppLayout em app/router.tsx. */
export function createPeopleRoutes(slots: PeopleRouteSlots): RouteObject[] {
  return [
    {
      path: "profile",
      handle: { title: "people:profile.title" } satisfies RouteHandle,
      element: (
        <ProfilePage
          renderActions={slots.renderProfileActions}
          renderHoursSummary={slots.renderProfileHoursSummary}
          renderHoursCards={slots.renderProfileHoursCards}
        />
      ),
    },
    // The list of students (GUS-137), the item "Alunos" of the menu.
    {
      path: "students",
      handle: { title: "common:nav.students" } satisfies RouteHandle,
      element: (
        <RequirePermission permission="students.view">
          <StudentsPage />
        </RequirePermission>
      ),
    },
    // The record of a student, opened from the list. The topbar title is the static "Aluno" on
    // purpose: the name and the accessibility of the student are health data (LGPD) and must not
    // reach the tab. The guard is `students.view`, the permission of "Alunos", which the sidebar
    // marks by the longest matching path.
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
}
