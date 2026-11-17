import {
  Calendar,
  DateField,
  DatePicker as HeroDatePicker,
  Description,
  FieldError,
  I18nProvider,
  Label,
} from "@heroui/react";
import { parseDate, type CalendarDate } from "@internationalized/date";
import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";

export interface DatePickerProps {
  label: ReactNode;
  /** The day as `YYYY-MM-DD`, the format of the API, or an empty string while there is none. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  description?: string;
  errorMessage?: string;
  isDisabled?: boolean;
  isRequired?: boolean;
  autoFocus?: boolean;
}

function toCalendarDate(value: string): CalendarDate | null {
  if (!value) return null;
  try {
    return parseDate(value);
  } catch {
    return null;
  }
}

/**
 * A day typed in segments (day, month and year, in the order of the language of the app) or picked
 * in the calendar that the button at the end opens, as the date fields of the Figma. It reads and
 * gives the day as `YYYY-MM-DD`, so a form keeps a plain string and sends it to the API as it is; a
 * day left half typed is the empty string. It knows nothing of the domain: what a valid day is for
 * the screen (a period that ends before it starts) is the form's to say.
 */
export function DatePicker({
  label,
  value,
  onChange,
  onBlur,
  name,
  description,
  errorMessage,
  isDisabled,
  isRequired,
  autoFocus,
}: DatePickerProps): ReactElement {
  const { i18n } = useTranslation();

  return (
    <I18nProvider locale={i18n.language}>
      <HeroDatePicker<CalendarDate>
        className="flex w-full flex-col gap-2"
        name={name}
        value={toCalendarDate(value)}
        onChange={(date) => onChange(date ? date.toString() : "")}
        onBlur={onBlur}
        isDisabled={isDisabled}
        isRequired={isRequired}
        isInvalid={Boolean(errorMessage)}
        validationBehavior="aria"
        autoFocus={autoFocus}
      >
        <Label className="text-base">{label}</Label>
        <DateField.Group fullWidth className="min-h-11 rounded-xl">
          <DateField.Input className="text-base sm:text-base">
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
          <DateField.Suffix>
            <HeroDatePicker.Trigger className="min-h-11 min-w-11">
              <HeroDatePicker.TriggerIndicator />
            </HeroDatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        {description && !errorMessage ? (
          <Description className="text-sm">{description}</Description>
        ) : null}
        {errorMessage ? <FieldError className="text-sm">{errorMessage}</FieldError> : null}
        <HeroDatePicker.Popover>
          <Calendar>
            <Calendar.Header>
              <Calendar.NavButton slot="previous" />
              <Calendar.Heading />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>
                {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
              </Calendar.GridHeader>
              <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
            </Calendar.Grid>
          </Calendar>
        </HeroDatePicker.Popover>
      </HeroDatePicker>
    </I18nProvider>
  );
}
