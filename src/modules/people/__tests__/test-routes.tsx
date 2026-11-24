// Registers the "people" namespace, as importing the module does.
import "../index";
import type { ProfilePageProps } from "../pages/ProfilePage";
import { createPeopleRoutes, type PeopleRouteSlots } from "../routes";

/**
 * The slots of "Meu perfil" as the tests of `people` (and the tests of the layout of `app/`) render
 * them. The hours belong to the `hours` module, which `people` does not import, so here each slot is
 * a stand-in that only says where it goes. The real pieces are tested in the `hours` module and put
 * together with these routes in `app/__tests__/people-slots.test.tsx`.
 */
export const STUB_PROFILE_SLOTS: PeopleRouteSlots = {
  renderProfileActions: () => <button type="button">Ação de horas (slot)</button>,
  renderProfileHoursSummary: () => <section aria-label="Resumo de horas (slot)" />,
  renderProfileHoursCards: () => <section aria-label="Cards de horas (slot)" />,
};

/** The same stand-ins, by the names of the props of `ProfilePage`. */
export const STUB_PROFILE_PAGE_PROPS: ProfilePageProps = {
  renderActions: STUB_PROFILE_SLOTS.renderProfileActions,
  renderHoursSummary: STUB_PROFILE_SLOTS.renderProfileHoursSummary,
  renderHoursCards: STUB_PROFILE_SLOTS.renderProfileHoursCards,
};

/** The routes of `people` with the stand-ins: what a test that is not about the hours mounts. */
export const peopleRoutes = createPeopleRoutes(STUB_PROFILE_SLOTS);
