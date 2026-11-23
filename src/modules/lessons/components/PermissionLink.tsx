import type { ReactElement } from "react";
import { Link } from "react-router-dom";

import { useCan } from "@modules/auth";
import type { Permission } from "@shared/lib/permissions";

import { LINK_CLASSES } from "./link-classes";

export interface PermissionLinkProps {
  /** The screen the link opens. */
  to: string;
  /** The permission that screen asks for: who does not have it sees the text and no link. */
  permission: Permission;
  children: string;
}

/**
 * A link to the screen of another module (the class, the course or the lesson plan of a lesson),
 * drawn only for who can open that screen. The cards of the lesson show those names to everybody who
 * can see the lesson, but a link that would end on the page of "sem acesso" is a trap for the person,
 * so without the permission of the route the name stays as plain text. The permission is the one the
 * route declares (`RequirePermission`), as the menu does: the back is still the authority (RNF-22).
 */
export function PermissionLink({ to, permission, children }: PermissionLinkProps): ReactElement {
  const canOpen = useCan(permission);

  if (!canOpen) return <>{children}</>;

  return (
    <Link to={to} className={LINK_CLASSES}>
      {children}
    </Link>
  );
}
