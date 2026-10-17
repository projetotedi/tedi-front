export type LessonPlanUsage = "in_use" | "unused" | "archived";

/** UI-only view model for the GUS-171 prototype. It is deliberately not an API DTO. */
export interface LessonPlanMock {
  id: string;
  title: string;
  contents: string[];
  expectedDurationMinutes: number;
  materialUrl: string;
  courseCount: number;
  classesUsedCount?: number | null;
  usage: LessonPlanUsage;
}

export const MOCK_LESSON_PLANS: LessonPlanMock[] = [
  {
    id: "lesson-plan-01",
    title: "Conhecendo o computador",
    contents: ["Ligar e desligar com segurança"],
    expectedDurationMinutes: 120,
    materialUrl: "https://example.com/material/computador",
    courseCount: 1,
    classesUsedCount: 4,
    usage: "in_use",
  },
  {
    id: "lesson-plan-02",
    title: "Teclado, mouse e janelas",
    contents: ["Teclado e mouse"],
    expectedDurationMinutes: 120,
    materialUrl: "https://example.com/material/teclado",
    courseCount: 1,
    classesUsedCount: 4,
    usage: "in_use",
  },
  {
    id: "lesson-plan-03",
    title: "Navegando na internet",
    contents: ["Navegador e busca"],
    expectedDurationMinutes: 120,
    materialUrl: "https://example.com/material/internet",
    courseCount: 2,
    classesUsedCount: 5,
    usage: "in_use",
  },
  {
    id: "lesson-plan-04",
    title: "Enviar um áudio no WhatsApp",
    contents: ["WhatsApp: mensagens e áudios"],
    expectedDurationMinutes: 90,
    materialUrl: "https://example.com/material/whatsapp-audio",
    courseCount: 2,
    classesUsedCount: 3,
    usage: "in_use",
  },
  {
    id: "lesson-plan-05",
    title: "Senhas e privacidade",
    contents: ["Privacidade e senhas"],
    expectedDurationMinutes: 90,
    materialUrl: "https://example.com/material/senhas",
    courseCount: 2,
    classesUsedCount: 3,
    usage: "in_use",
  },
  {
    id: "lesson-plan-06",
    title: "Reconhecendo golpes",
    contents: ["Golpes por mensagem"],
    expectedDurationMinutes: 150,
    materialUrl: "https://example.com/material/golpes",
    courseCount: 1,
    classesUsedCount: 2,
    usage: "in_use",
  },
  {
    id: "lesson-plan-07",
    title: "Fotos no celular",
    contents: ["Câmera e fotos"],
    expectedDurationMinutes: 90,
    materialUrl: "https://example.com/material/fotos",
    courseCount: 0,
    classesUsedCount: null,
    usage: "unused",
  },
  {
    id: "lesson-plan-08",
    title: "Organizando arquivos",
    contents: ["Pastas e documentos"],
    expectedDurationMinutes: 60,
    materialUrl: "https://example.com/material/arquivos",
    courseCount: 1,
    classesUsedCount: 2,
    usage: "in_use",
  },
  {
    id: "lesson-plan-09",
    title: "Videochamadas com a família",
    contents: ["Chamadas de vídeo", "Privacidade"],
    expectedDurationMinutes: 90,
    materialUrl: "https://example.com/material/videochamadas",
    courseCount: 0,
    classesUsedCount: null,
    usage: "unused",
  },
  {
    id: "lesson-plan-10",
    title: "E-mail no dia a dia",
    contents: ["Enviar e receber mensagens"],
    expectedDurationMinutes: 120,
    materialUrl: "https://example.com/material/email",
    courseCount: 1,
    classesUsedCount: 2,
    usage: "in_use",
  },
  {
    id: "lesson-plan-11",
    title: "Compras seguras pela internet",
    contents: ["Segurança digital", "Compras on-line"],
    expectedDurationMinutes: 150,
    materialUrl: "https://example.com/material/compras-seguras",
    courseCount: 1,
    classesUsedCount: 2,
    usage: "in_use",
  },
  {
    id: "lesson-plan-12",
    title: "Aplicativos úteis",
    contents: ["Aplicativos", "Acessibilidade"],
    expectedDurationMinutes: 90,
    materialUrl: "https://example.com/material/aplicativos",
    courseCount: 0,
    classesUsedCount: null,
    usage: "unused",
  },
  {
    id: "lesson-plan-13",
    title: "Mapas e localização",
    contents: ["GPS e mapas"],
    expectedDurationMinutes: 90,
    materialUrl: "https://example.com/material/mapas",
    courseCount: 1,
    classesUsedCount: 1,
    usage: "in_use",
  },
  {
    id: "lesson-plan-14",
    title: "Introdução às redes sociais",
    contents: ["Redes sociais", "Privacidade"],
    expectedDurationMinutes: 120,
    materialUrl: "https://example.com/material/redes-sociais",
    courseCount: 0,
    classesUsedCount: 1,
    usage: "unused",
  },
  {
    id: "lesson-plan-15",
    title: "Noções de segurança digital",
    contents: ["Segurança digital", "Privacidade"],
    expectedDurationMinutes: 90,
    materialUrl: "https://example.com/material/seguranca-arquivada",
    courseCount: 1,
    classesUsedCount: 0,
    usage: "archived",
  },
];

export const MOCK_LESSON_PLAN_OBJECTIVES: Record<string, string> = {
  "lesson-plan-04": "Gravar, ouvir e enviar um áudio no WhatsApp.",
  "lesson-plan-01": "Aprender a ligar e desligar o computador com segurança.",
};
