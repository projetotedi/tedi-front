import { useId, type ReactElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { MemberRegistrationResponseDto } from "@api/generated/model";

import {
  ageOn,
  formatCalendarDate,
  formatCpfForDisplay,
  formatPhoneForDisplay,
  todayInAppTimeZone,
} from "../lib/registration-format";

export interface RegistrationSubmittedDataProps {
  registration: MemberRegistrationResponseDto;
}

interface DataRow {
  key: string;
  label: string;
  value: ReactNode;
}

/** O termo é um link que a pessoa enviou: só abre se for https, nunca `javascript:` nem `data:`. */
function isSafeTermUrl(url: string): boolean {
  return url.startsWith("https://");
}

/** O mesmo texto de link das telas do catálogo: 44px de alvo e um anel de foco visível. */
const LINK_CLASSES =
  "-mx-1 inline-flex min-h-11 items-center rounded-sm px-1 font-medium text-sky-800 underline underline-offset-2 outline-hidden focus-visible:ring-3 focus-visible:ring-focus";

/**
 * O cadastro que o membro enviou, só para leitura: a coordenação confere com o RA e o termo antes
 * de decidir. Campo sem valor mostra "Não informado". Segue as cinco linhas do Figma, em três
 * colunas (duas em tela média, uma no celular).
 */
export function RegistrationSubmittedData({
  registration,
}: RegistrationSubmittedDataProps): ReactElement {
  const { t, i18n } = useTranslation("auth");
  const titleId = useId();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const notProvided = (
    <span className="text-muted">{t("registrationReview.submitted.notProvided")}</span>
  );

  function text(value: string | null): ReactNode {
    return value === null || value.trim() === "" ? notProvided : value;
  }

  function birthDate(value: string | null): ReactNode {
    if (value === null) return notProvided;

    const date = formatCalendarDate(value, locale);
    const age = ageOn(value, todayInAppTimeZone());
    return age === null ? date : t("registrationReview.submitted.birthDate", { date, count: age });
  }

  function volunteerTerm(url: string | null): ReactNode {
    if (url === null || url.trim() === "") return notProvided;
    if (!isSafeTermUrl(url)) return <span className="break-all">{url}</span>;

    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={LINK_CLASSES}>
        {t("registrationReview.submitted.openTerm")}
      </a>
    );
  }

  const label = (field: string) => t(`registrationReview.submitted.fields.${field}`);

  const rows: DataRow[] = [
    { key: "name", label: label("name"), value: text(registration.name) },
    { key: "birthDate", label: label("birthDate"), value: birthDate(registration.birthDate) },
    {
      key: "cpf",
      label: label("cpf"),
      value: text(registration.cpf === null ? null : formatCpfForDisplay(registration.cpf)),
    },
    {
      key: "phone",
      label: label("phone"),
      value: text(registration.phone === null ? null : formatPhoneForDisplay(registration.phone)),
    },
    {
      key: "personalEmail",
      label: label("personalEmail"),
      value: text(registration.personalEmail),
    },
    {
      key: "institutionalEmail",
      label: label("institutionalEmail"),
      value: text(registration.institutionalEmail),
    },
    { key: "address", label: label("address"), value: text(registration.address) },
    { key: "city", label: label("city"), value: text(registration.city) },
    { key: "state", label: label("state"), value: text(registration.state) },
    { key: "ra", label: label("ra"), value: text(registration.ra) },
    { key: "course", label: label("course"), value: text(registration.course) },
    {
      key: "semester",
      label: label("semester"),
      value:
        registration.semester === null
          ? notProvided
          : t("registrationReview.submitted.semester", { semester: registration.semester }),
    },
    { key: "className", label: label("className"), value: text(registration.className) },
    {
      key: "department",
      label: label("department"),
      value: text(registration.department?.name ?? null),
    },
    {
      key: "volunteerTerm",
      label: label("volunteerTerm"),
      value: volunteerTerm(registration.volunteerTermUrl),
    },
  ];

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 id={titleId} className="text-base font-semibold text-foreground">
          {t("registrationReview.submitted.title")}
        </h3>
        <p className="text-base text-muted">{t("registrationReview.submitted.legend")}</p>
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
        {rows.map((row) => (
          <div key={row.key} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-sm font-medium tracking-wide text-muted uppercase">{row.label}</dt>
            <dd className="text-base break-words text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
