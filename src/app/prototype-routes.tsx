import type { RouteObject } from "react-router-dom";

import { RequirePermission } from "@modules/auth";
import type { RouteHandle } from "@shared/lib/route-handle";

import { prototypeMenuItems } from "./menu";
import { ComingSoonPage } from "./pages/ComingSoonPage";

/** Uma rota "Em breve" por item do protótipo, com o mesmo título e a mesma permissão do item. */
export const prototypeRoutes: RouteObject[] = prototypeMenuItems.map((item) => ({
  path: item.path.slice(1),
  handle: { title: item.label } satisfies RouteHandle,
  element: (
    <RequirePermission permission={item.permission}>
      <ComingSoonPage />
    </RequirePermission>
  ),
}));
