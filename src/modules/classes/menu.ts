import graduationCapIcon from "../../assets/icons/graduation-cap.svg";
import type { MenuItem } from "@shared/lib/menu";

export const classesMenuItems: MenuItem[] = [
  {
    label: "common:nav.classes",
    path: "/classes",
    permission: "classes.view",
    icon: graduationCapIcon,
  },
];
