// Registers the "auth" namespace, as importing the module does.
import "../index";
import type { AccessPageProps } from "../pages/AccessPage";
import { createAuthProtectedRoutes, type AuthRouteSlots } from "../routes";

/**
 * The dialogs of a row of Membros as the tests of `auth` (and the tests of the layout of `app/`)
 * render them. Editar membro and Inativar membro belong to the `people` module, which `auth` does
 * not import, so here each slot is a stand-in that only says for whom it was opened and gives back
 * its callbacks. The real dialogs are tested in `people` and put together with these routes in
 * `app/__tests__/auth-slots.test.tsx`.
 */
export const STUB_MEMBER_DIALOG_SLOTS: AuthRouteSlots = {
  renderEditMemberDialog: ({ member, onClose }) => (
    <div role="dialog" aria-label={`Editar membro (slot) de ${member.name}`}>
      <button type="button" onClick={onClose}>
        Fechar edição (slot)
      </button>
    </div>
  ),
  renderDeactivateMemberDialog: ({ member, onClose, onDeactivated }) => (
    <div role="dialog" aria-label={`Inativar membro (slot) de ${member.name}`}>
      <button
        type="button"
        onClick={() => {
          onDeactivated();
          onClose();
        }}
      >
        Inativar (slot)
      </button>
      <button type="button" onClick={onClose}>
        Voltar (slot)
      </button>
    </div>
  ),
};

/** The same stand-ins, by the names of the props of `AccessPage`. */
export const STUB_ACCESS_PAGE_PROPS: AccessPageProps = STUB_MEMBER_DIALOG_SLOTS;

/** The routes of `auth` behind the session, with the stand-ins: what a test that is not about the dialogs mounts. */
export const authProtectedRoutes = createAuthProtectedRoutes(STUB_MEMBER_DIALOG_SLOTS);
