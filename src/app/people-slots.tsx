import { LogHoursButton, MyCategoryHoursCard, MyEntriesCard, MyHoursSummary } from "@modules/hours";
import type { PeopleRouteSlots } from "@modules/people";

/**
 * O que as telas do `people` pedem a outros módulos. `people` não importa `hours` (módulo é caixa
 * fechada, e pelo domínio o lançamento de horas pertence à pessoa: `hours → people` no back), então o
 * que o Meu perfil mostra que é do `hours` chega por slot, e quem compõe é o `app/`, o único lugar que
 * conhece os dois:
 *
 * - "+ Lançar horas" (GUS-163), no cabeçalho, depois de "Editar meus dados";
 * - os quatro números das horas, entre o cabeçalho e as colunas;
 * - os cards "Meus lançamentos" e "Horas por categoria", no topo da coluna principal.
 *
 * Cada peça faz a própria consulta de `/me/*`, então a falha de uma aparece só nela.
 */
export const peopleRouteSlots: PeopleRouteSlots = {
  renderProfileActions: () => <LogHoursButton />,
  renderProfileHoursSummary: () => <MyHoursSummary />,
  renderProfileHoursCards: () => (
    <>
      <MyEntriesCard />
      <MyCategoryHoursCard />
    </>
  ),
};
