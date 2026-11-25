import type { ReactElement } from "react";
import type { RouteObject } from "react-router-dom";

import type { MeResponseDto } from "@api/generated/model";

import { buildMeUser } from "./application-handlers";
import { renderRoutes, renderWithProviders } from "./test-utils";

/*
 * The renders of the screens of the applications (GUS-161): the same as `test-utils`, but the
 * person of the session is, unless the test says otherwise, the member of `application-handlers`
 * (the one who applies, with `assignments.manageOwn` and without `assignments.review`), not the
 * coordinator of the fixtures of the allocation (GUS-159).
 */

interface ApplicationRenderOptions {
  route?: string;
  user?: MeResponseDto | null;
}

function withMember(options: ApplicationRenderOptions): ApplicationRenderOptions {
  return { user: buildMeUser(), ...options };
}

export function renderAsMember(ui: ReactElement, options: ApplicationRenderOptions = {}) {
  return renderWithProviders(ui, withMember(options));
}

export function renderRoutesAsMember(
  routes: RouteObject[],
  options: ApplicationRenderOptions = {},
) {
  return renderRoutes(routes, withMember(options));
}
