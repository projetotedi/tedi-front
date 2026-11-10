import type { CategoryHoursSummary, HoursEntry, HoursSummaryMinutes } from "../../lib/hours";

/**
 * Sample hours for the tests of the hours cards. The page itself shows no hours until GUS-163, so
 * only the component tests use these values (the ones of the Figma prototype, "Telas · Conta").
 */

export const SAMPLE_SUMMARY: HoursSummaryMinutes = {
  total: 3480,
  validated: 2880,
  pending: 480,
  adjustedOrRejected: 120,
};

export const SAMPLE_ENTRIES: HoursEntry[] = [
  {
    id: "e1",
    date: "2026-03-14",
    activity: "Reunião de coordenação",
    category: "management",
    declaredMinutes: 120,
    validatedMinutes: 120,
    status: "approved",
  },
  {
    id: "e2",
    date: "2026-03-12",
    activity: "Planejamento de conteúdo do bimestre",
    category: "planning",
    declaredMinutes: 180,
    validatedMinutes: 120,
    status: "adjusted",
  },
  {
    id: "e3",
    date: "2026-03-10",
    activity: "Aula — Teclado, mouse e janelas (INFO-A)",
    category: "class",
    declaredMinutes: 120,
    validatedMinutes: 120,
    status: "approved",
  },
  {
    id: "e4",
    date: "2026-03-08",
    activity: "Feira de tecnologia (evento externo)",
    category: "event",
    declaredMinutes: 240,
    validatedMinutes: null,
    status: "pending",
  },
  {
    id: "e5",
    date: "2026-02-28",
    activity: "Material de apoio sem comprovação",
    category: "other",
    declaredMinutes: 120,
    validatedMinutes: 0,
    status: "rejected",
  },
];

export const SAMPLE_BY_CATEGORY: CategoryHoursSummary = {
  period: "2026-03",
  rows: [
    {
      category: "class",
      totalMinutes: 1680,
      pendingMinutes: 0,
      note: "Geradas pela presença nas aulas das turmas",
    },
    {
      category: "management",
      totalMinutes: 1200,
      pendingMinutes: 0,
      note: "Reuniões administrativas do projeto",
    },
    {
      category: "planning",
      totalMinutes: 480,
      pendingMinutes: 480,
      note: "Aguardando validação da coordenação",
    },
    {
      category: "event",
      totalMinutes: 120,
      pendingMinutes: 0,
      note: "Feira de tecnologia — ajustado para 2h",
    },
  ],
};
