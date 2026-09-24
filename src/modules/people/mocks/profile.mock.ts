/**
 * Dados de exemplo da tela "Meu perfil" (valores do protótipo do Figma, seção "Telas · Conta").
 * Nome, perfil e RA vêm da sessão; o resto ainda não existe no back. TODO: trocar pelos
 * hooks gerados quando os cards de horas e de cadastro entregarem os endpoints.
 */

export type AccountStatus = "active" | "inactive";
export type EntryStatus = "approved" | "adjusted" | "pending" | "rejected";
export type CategoryStatus = "validated" | "pending" | "adjusted";
export type HoursCategory = "class" | "management" | "planning" | "event" | "other";

export interface HoursEntry {
  id: string;
  /** Data local, `YYYY-MM-DD`. */
  date: string;
  activity: string;
  category: HoursCategory;
  declaredMinutes: number;
  /** null enquanto não validado. */
  validatedMinutes: number | null;
  status: EntryStatus;
}

export interface CategoryHours {
  category: HoursCategory;
  hours: number;
  status: CategoryStatus;
  note: string;
}

export interface ProfileMock {
  status: AccountStatus;
  department: string;
  /** Data local, `YYYY-MM-DD`. */
  joinedAt: string;
  /** Data e hora locais, `YYYY-MM-DDTHH:mm`. */
  lastAccessAt: string;
  hours: { total: number; validated: number; pending: number; adjustedOrRejected: number };
  entries: HoursEntry[];
  /** Mês de referência, `YYYY-MM`. */
  categoryPeriod: string;
  hoursByCategory: CategoryHours[];
  personal: {
    birthDate: string;
    phone: string;
    personalEmail: string;
    address: string;
    city: string;
    state: string;
  };
  academic: {
    course: string;
    className: string;
    semester: number;
    institutionalEmail: string;
    cpfMasked: string;
    /** Texto do link, como no protótipo; vira link de verdade quando o dado existir. */
    volunteerTerm: string;
  };
}

export const profileMock: ProfileMock = {
  status: "active",
  department: "Tecnologia",
  joinedAt: "2024-03-01",
  lastAccessAt: "2026-03-14T09:12",
  hours: { total: 58, validated: 48, pending: 8, adjustedOrRejected: 2 },
  entries: [
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
  ],
  categoryPeriod: "2026-03",
  hoursByCategory: [
    {
      category: "class",
      hours: 28,
      status: "validated",
      note: "Geradas pela presença nas aulas das turmas",
    },
    {
      category: "management",
      hours: 20,
      status: "validated",
      note: "Reuniões administrativas do projeto",
    },
    {
      category: "planning",
      hours: 8,
      status: "pending",
      note: "Aguardando validação da coordenação",
    },
    {
      category: "event",
      hours: 2,
      status: "adjusted",
      note: "Feira de tecnologia — ajustado para 2h",
    },
  ],
  personal: {
    birthDate: "1999-07-22",
    phone: "(11) 98181-3030",
    personalEmail: "ana.torres@email.com",
    address: "Rua das Acácias, 120 — apto 42",
    city: "São Paulo",
    state: "SP",
  },
  academic: {
    course: "Sistemas de Informação",
    className: "SI-2024-N",
    semester: 7,
    institutionalEmail: "ana.torres@inst.edu.br",
    cpfMasked: "•••.•••.321-00",
    volunteerTerm: "drive.google.com/…/termo-ana",
  },
};
