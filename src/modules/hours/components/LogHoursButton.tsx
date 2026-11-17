import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useCan } from "@modules/auth";
import { Button } from "@shared/ui";

import { LogHoursDialog } from "./LogHoursDialog";

/**
 * "+ Lançar horas" of "Meu perfil": opens `LogHoursDialog` for the person's own hours. It is drawn for
 * whoever manages her own account (`account.manageOwn`, every profile) and for nobody else, not even
 * disabled. The plus sign is decoration: the button is named "Lançar horas". The dialog is mounted
 * only while it is open, and the focus goes back to the button when it closes.
 */
export function LogHoursButton(): ReactElement | null {
  const { t } = useTranslation("hours");
  const canLog = useCan("account.manageOwn");
  const [isOpen, setIsOpen] = useState(false);

  if (!canLog) return null;

  return (
    <>
      <Button variant="secondary" onPress={() => setIsOpen(true)}>
        <span aria-hidden="true">+</span> {t("logHours.open")}
      </Button>
      {isOpen ? <LogHoursDialog onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}
