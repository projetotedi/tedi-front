import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useCan } from "@modules/auth";
import { Button } from "@shared/ui";

import { LogHoursDialog, type LogHoursMember } from "./LogHoursDialog";

export interface LogHoursForMemberButtonProps {
  /** The member whose hours are logged, as her sheet knows her. */
  member: LogHoursMember;
}

/**
 * "+ Lançar horas" of the sheet of a member: opens `LogHoursDialog` on behalf of that member. It is
 * drawn only for who may log for others (`hours.logForOthers`: the director for the members of her
 * department, the coordination for anyone) and for nobody else, not even disabled; whether this
 * member is in the department of the director is for the API to say (403 `FORBIDDEN_SCOPE`, which
 * the dialog tells). It is the piece the slot of the sheet uses (GUS-145); no screen draws it yet.
 */
export function LogHoursForMemberButton({
  member,
}: LogHoursForMemberButtonProps): ReactElement | null {
  const { t } = useTranslation("hours");
  const canLogForOthers = useCan("hours.logForOthers");
  const [isOpen, setIsOpen] = useState(false);

  if (!canLogForOthers) return null;

  return (
    <>
      <Button variant="secondary" onPress={() => setIsOpen(true)}>
        <span aria-hidden="true">+</span> {t("logHours.open")}
      </Button>
      {isOpen ? <LogHoursDialog member={member} onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}
