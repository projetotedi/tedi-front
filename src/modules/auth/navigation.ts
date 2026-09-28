import personsIconUrl from "@shared/assets/icons/persons.svg";
import type { NavItem } from "@shared/lib/navigation";

export const authNavItems: NavItem[] = [
  {
    to: "/access",
    labelNs: "auth",
    labelKey: "nav.access",
    iconSrc: personsIconUrl,
  },
];
