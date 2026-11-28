import type { AuthRouteSlots } from "@modules/auth";
import { DeactivateMemberDialog, EditMemberDialog } from "@modules/people";

/**
 * What the list of Membros of `auth` asks of `people` (GUS-194). Editar membro and Inativar membro
 * belong to `people`, which already imports `auth` (Meu perfil uses `useAuth`): `auth` importing
 * `people` would close a cycle, so the list asks for them by slot and `app/`, the only place that
 * knows both, fills them:
 *
 * - Editar membro, from the pencil of a row;
 * - Inativar membro, from the bin of a row.
 *
 * Each dialog loads what it needs and refreshes the list when it saves.
 */
export const authRouteSlots: AuthRouteSlots = {
  renderEditMemberDialog: ({ member, onClose }) => (
    <EditMemberDialog key={member.id} memberId={member.id} onClose={onClose} />
  ),
  renderDeactivateMemberDialog: ({ member, onClose, onDeactivated }) => (
    <DeactivateMemberDialog
      key={member.id}
      member={member}
      onClose={onClose}
      onDeactivated={onDeactivated}
    />
  ),
};
