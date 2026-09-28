import type { RouteObject } from "react-router-dom";

import type { RouteHandle } from "@shared/lib/route-handle";

import { ProfilePage } from "./pages/ProfilePage";

/** Rotas autenticadas do módulo, montadas sob AppLayout em app/router.tsx. */
export const peopleRoutes: RouteObject[] = [
  {
    path: "profile",
    handle: { title: "people:profile.title" } satisfies RouteHandle,
    element: <ProfilePage />,
  },
];
