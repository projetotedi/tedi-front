import { http, HttpResponse } from "msw";

import {
  AccessibilityNeed,
  type MyProfileResponseDto,
  type StudentDetailDto,
} from "@api/generated/model";
import { Role } from "@shared/lib/role";

/**
 * Handlers MSW written by hand over the real contract (GET /members/me, GET /students/:id). The path has a wildcard
 * prefix because http-client.ts prefixes the URL with VITE_API_URL at runtime: the test does not
 * need to know it.
 */

/** A member whose registration was approved: every field of the contract example is filled. */
export function buildMyProfile(
  overrides: Partial<MyProfileResponseDto> = {},
): MyProfileResponseDto {
  return {
    name: "Ana Torres",
    ra: "a2210001",
    role: Role.member,
    accessEnabled: true,
    birthDate: "1999-07-22",
    phone: "11981813030",
    email: "ana.torres@example.com",
    personalEmail: "ana.torres@example.com",
    address: "Rua das Acácias, 120, apto 42",
    city: "São Paulo",
    state: "SP",
    institutionalEmail: "ana.torres@example.edu",
    course: "Sistemas de Informação",
    semester: 7,
    className: "SI-2024-N",
    volunteerTermUrl: "https://drive.google.com/file/d/exemplo/view",
    mainFunction: "Monitora de informática",
    department: { id: "01952ef7-0000-7000-8000-0000000000d1", name: "Tecnologia" },
    joinedAt: "2026-10-01",
    cpfMasked: "***.***.247-25",
    lastLoginAt: "2026-10-20T13:00:00.000Z",
    ...overrides,
  };
}

/**
 * The seeded coordinator: a Person with an access profile but no member profile. The seed gives
 * her RA, name and e-mail (ADMIN_RA, ADMIN_NAME, ADMIN_EMAIL); every member field is `null`,
 * `personalEmail`, `birthDate` and `phone` included, and so is `lastLoginAt` before the second login.
 */
export function buildSeedProfile(): MyProfileResponseDto {
  return {
    name: "Marina Albuquerque",
    ra: "a0000001",
    role: Role.coordinator,
    accessEnabled: true,
    birthDate: null,
    phone: null,
    email: "marina.albuquerque@example.com",
    personalEmail: null,
    address: null,
    city: null,
    state: null,
    institutionalEmail: null,
    course: null,
    semester: null,
    className: null,
    volunteerTermUrl: null,
    mainFunction: null,
    department: null,
    joinedAt: null,
    cpfMasked: null,
    lastLoginAt: null,
  };
}

interface MyProfileHandlerOptions {
  profile?: MyProfileResponseDto;
  /** Answers with the `ApiErrorDto` shape and this status instead of the profile. */
  error?: { statusCode: number; error: string; message?: string };
  /** Holds the response until the promise settles. */
  delay?: Promise<void>;
  onCall?: () => void;
}

export function myProfileHandler({
  profile = buildMyProfile(),
  error,
  delay,
  onCall,
}: MyProfileHandlerOptions = {}) {
  return http.get("*/members/me", async () => {
    onCall?.();
    if (delay) await delay;

    if (error) {
      return HttpResponse.json(
        { statusCode: error.statusCode, error: error.error, message: error.message ?? error.error },
        { status: error.statusCode },
      );
    }
    return HttpResponse.json(profile);
  });
}

/** A UUID v7, which is what the API generates: the page asks nothing of an id that is not one. */
export const STUDENT_ID = "01952ef7-0000-7000-8000-0000000000e1";

export const STUDENT_NAME = "Maria da Silva Santos";
export const STUDENT_CREATOR_NAME = "Beatriz Nunes";

/** The 404 of `GET /students/:id` for an id that does not exist (or has no student profile). */
export const STUDENT_NOT_FOUND_ERROR: ApiErrorOptions = {
  statusCode: 404,
  error: "STUDENT_NOT_FOUND",
  message: "Student not found.",
};

/**
 * A student with every field of the contract filled: Maria, 67 years old, with a visual need,
 * registered by Beatriz on 18/02/2026 and active. The instants are at 13:00 UTC on purpose: the
 * day is the same in every time zone from UTC-12 to UTC+10, so a test that reads the date does not
 * depend on the machine that runs the suite.
 */
export function buildStudentDetail(overrides: Partial<StudentDetailDto> = {}): StudentDetailDto {
  return {
    id: STUDENT_ID,
    name: STUDENT_NAME,
    birthDate: "1959-03-14",
    age: 67,
    phone: "11987654321",
    email: "maria.santos@example.com",
    education: "Ensino médio completo",
    hasSmartphone: true,
    hasComputer: false,
    howFoundUs: "Indicação de uma amiga",
    emergencyContact: { name: "João Santos", phone: "11912345678" },
    accessibilityNeed: AccessibilityNeed.visual,
    classNeeds: "Sentar perto da tela e material com letra grande",
    supportResource: "Lupa e fonte ampliada",
    createdAt: "2026-02-18T13:00:00.000Z",
    updatedAt: "2026-10-20T13:00:00.000Z",
    createdBy: { id: "01952ef7-0000-7000-8000-0000000000f1", name: STUDENT_CREATOR_NAME },
    archivedAt: null,
    archiveReason: null,
    ...overrides,
  };
}

interface ApiErrorOptions {
  statusCode: number;
  error: string;
  message?: string;
}

interface GetStudentHandlerOptions {
  student?: StudentDetailDto;
  /** Answers with the `ApiErrorDto` shape and this status instead of the student. */
  error?: ApiErrorOptions;
  /** Holds the response until the promise settles. */
  delay?: Promise<void>;
  /** Called with the id of the path every time the API is asked. */
  onCall?: (call: { id: string }) => void;
}

export function getStudentHandler({
  student = buildStudentDetail(),
  error,
  delay,
  onCall,
}: GetStudentHandlerOptions = {}) {
  return http.get("*/students/:id", async ({ params }) => {
    onCall?.({ id: String(params.id) });
    if (delay) await delay;

    if (error) {
      return HttpResponse.json(
        { statusCode: error.statusCode, error: error.error, message: error.message ?? error.error },
        { status: error.statusCode },
      );
    }
    return HttpResponse.json(student);
  });
}
