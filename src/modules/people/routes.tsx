import type { ReactNode } from "react";
import type { RouteObject } from "react-router-dom";

import type { RouteHandle } from "@shared/lib/route-handle";

import { ProfilePage } from "./pages/ProfilePage";

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
  ];
}
