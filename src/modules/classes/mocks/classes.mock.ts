import {
  ClassStatus,
  CourseCategory,
  CourseStatus,
  type ClassCourseResponseDto,
} from "@api/generated/model";

/**
 * The courses of the prototype, with the shape the API gives a class for its course
 * (`ClassCourseResponseDto`): the category is the one of the course, and "Fotografia digital" is
 * archived, so the class form has a course it must not offer. TEMPORARY: until `GET /courses`
 * exists (see `useCourseOptions`).
 */
export const mockCourses: ClassCourseResponseDto[] = [
  {
    id: "computer",
    name: "Informática Básica",
    category: CourseCategory.basic,
    status: CourseStatus.active,
  },
  {
    id: "phone",
    name: "Smartphones no dia a dia",
    category: CourseCategory.basic,
    status: CourseStatus.active,
  },
  {
    id: "internet",
    name: "Internet",
    category: CourseCategory.intermediate,
    status: CourseStatus.active,
  },
  {
    id: "social",
    name: "Redes Sociais com Segurança",
    category: CourseCategory.intermediate,
    status: CourseStatus.active,
  },
  {
    id: "photo",
    name: "Fotografia digital",
    category: CourseCategory.advanced,
    status: CourseStatus.archived,
  },
  {
    id: "security",
    name: "Segurança digital",
    category: CourseCategory.intermediate,
    status: CourseStatus.active,
  },
];

/**
 * A class of the prototype list. It has no course name and no level: both come from the course it
 * points to by `courseId` (RN-14), so changing the category of the course changes it here too.
 */
export interface ClassRecord {
  id: string;
  code: string;
  name: string;
  courseId: string;
  editionId: string;
  edition: string;
  start: string;
  end: string;
  location?: string;
  enrolled: number;
  capacity: number;
  status: ClassStatus;
  archived: boolean;
}

export const initialClasses: ClassRecord[] = [
  {
    id: "1",
    code: "TUR-2026.2",
    name: "Turma 2026.2",
    courseId: "computer",
    editionId: "2026-1",
    edition: "1º semestre 2026",
    start: "2026-03-03",
    end: "2026-05-27",
    enrolled: 12,
    capacity: 15,
    status: ClassStatus.in_progress,
    archived: false,
  },
  {
    id: "2",
    code: "TUR-2025.2",
    name: "Turma 2025.2",
    courseId: "internet",
    editionId: "2025-2",
    edition: "2º semestre 2025",
    start: "2025-07-03",
    end: "2025-08-27",
    enrolled: 9,
    capacity: 12,
    status: ClassStatus.in_progress,
    archived: false,
  },
  {
    id: "3",
    code: "TUR-2024",
    name: "Turma 2024",
    courseId: "computer",
    editionId: "2024",
    edition: "2024",
    start: "2024-06-02",
    end: "2024-08-12",
    enrolled: 6,
    capacity: 15,
    status: ClassStatus.planned,
    archived: false,
  },
  {
    id: "4",
    code: "TUR-004",
    name: "Informática Básica — B (2025)",
    courseId: "computer",
    editionId: "2025-2",
    edition: "2º semestre 2025",
    start: "2025-08-05",
    end: "2025-12-12",
    enrolled: 15,
    capacity: 15,
    status: ClassStatus.completed,
    archived: false,
  },
  {
    id: "5",
    code: "TUR-005",
    name: "Smartphones no dia a dia — B",
    courseId: "phone",
    editionId: "2026-1",
    edition: "1º semestre 2026",
    start: "2026-03-10",
    end: "2026-06-30",
    enrolled: 14,
    capacity: 16,
    status: ClassStatus.in_progress,
    archived: false,
  },
  {
    id: "6",
    code: "TUR-006",
    name: "Redes Sociais com Segurança — C",
    courseId: "social",
    editionId: "2026-2",
    edition: "2º semestre 2026",
    start: "2026-04-06",
    end: "2026-07-24",
    enrolled: 0,
    capacity: 15,
    status: ClassStatus.planned,
    archived: false,
  },
  {
    id: "7",
    code: "TUR-007",
    name: "Informática Básica — D",
    courseId: "computer",
    editionId: "2026-1",
    edition: "1º semestre 2026",
    start: "2026-04-13",
    end: "2026-07-31",
    enrolled: 3,
    capacity: 15,
    status: ClassStatus.planned,
    archived: false,
  },
  {
    id: "8",
    code: "TUR-008",
    name: "Smartphones no dia a dia — A (2025)",
    courseId: "phone",
    editionId: "2025-1",
    edition: "1º semestre 2025",
    start: "2025-03-04",
    end: "2025-06-26",
    enrolled: 15,
    capacity: 15,
    status: ClassStatus.completed,
    archived: false,
  },
  {
    id: "9",
    code: "TUR-009",
    name: "Informática Básica — C",
    courseId: "computer",
    editionId: "2026-1",
    edition: "1º semestre 2026",
    start: "2026-03-17",
    end: "2026-07-07",
    enrolled: 11,
    capacity: 15,
    status: ClassStatus.in_progress,
    archived: false,
  },
  {
    id: "10",
    code: "TUR-010",
    name: "Redes Sociais com Segurança — A (2025)",
    courseId: "social",
    editionId: "2025-2",
    edition: "2º semestre 2025",
    start: "2025-08-05",
    end: "2025-12-12",
    enrolled: 13,
    capacity: 15,
    status: ClassStatus.completed,
    archived: false,
  },
  {
    id: "11",
    code: "TUR-011",
    name: "Mensagens e contatos",
    courseId: "phone",
    editionId: "2025-1",
    edition: "1º semestre 2025",
    start: "2025-02-01",
    end: "2025-06-30",
    enrolled: 14,
    capacity: 18,
    status: ClassStatus.completed,
    archived: false,
  },
  {
    id: "12",
    code: "TUR-012",
    name: "Navegação segura",
    courseId: "internet",
    editionId: "2025-1",
    edition: "1º semestre 2025",
    start: "2025-02-01",
    end: "2025-06-30",
    enrolled: 13,
    capacity: 18,
    status: ClassStatus.completed,
    archived: false,
  },
];
