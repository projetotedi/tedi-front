import personsIconUrl from "@shared/assets/icons/persons.svg";
import type { NavItem } from "@shared/lib/navigation";

/**
 * Itens do menu lateral que o módulo `auth` contribui. Sem `minRole`: o Figma mostra o item para
 * todos os perfis (inclusive na tela 403 de um Membro, que é onde ele cai ao abrir `/access`).
 * Quem decide quem entra é a `RequireRole` da rota; o filtro por perfil do menu é da GUS-86.
 */
export const authNavItems: NavItem[] = [
  {
    to: "/access",
    labelNs: "auth",
    labelKey: "nav.access",
    iconSrc: personsIconUrl,
  },
];
