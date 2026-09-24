import type { RouteObject } from "react-router-dom";

import type { RouteHandle } from "@shared/lib/route-handle";

import { prototypeMenuItems } from "./menu";
import { ComingSoonPage } from "./pages/ComingSoonPage";

/** Uma rota "Em breve" por item do protótipo, com o mesmo título do item. */
export const prototypeRoutes: RouteObject[] = prototypeMenuItems.map((item) => ({
  path: item.path.slice(1),
  handle: { title: item.label } satisfies RouteHandle,
  element: <ComingSoonPage />,
}));
