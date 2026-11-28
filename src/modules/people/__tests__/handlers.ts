import { http, HttpResponse } from "msw";

import {
  AccessibilityNeed,
  MemberRegistrationStatus,
  MemberStatus,
  type MemberDetailResponseDto,
  type MyProfileResponseDto,
  type StudentDetailDto,
} from "@api/generated/model";
import { Role } from "@shared/lib/role";

/**
 * Handlers MSW written by hand over the real contract (GET /members/me, GET /members/:id,
 * GET /students/:id). The path has a wildcard prefix because http-client.ts prefixes the URL with
 * VITE_API_URL at runtime: the test does not need to know it.
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

/** A UUID v7 as well, and not the `m1` of a draft: `GetMemberParams` accepts only a real UUID. */
export const MEMBER_ID = "01952ef7-0000-7000-8000-0000000000c1";

export const MEMBER_NAME = "Beatriz Nunes Carvalho";
export const MEMBER_APPROVER_NAME = "Ana Paula Torres";

/** The 404 of `GET /members/:id` for an id that does not exist. */
export const MEMBER_NOT_FOUND_ERROR: ApiErrorOptions = {
  statusCode: 404,
  error: "MEMBER_NOT_FOUND",
  message: "Member not found.",
};

/** The 403 of `GET /members/:id` for a member outside the scope of who asks. */
export const FORBIDDEN_SCOPE_ERROR: ApiErrorOptions = {
  statusCode: 403,
  error: "FORBIDDEN_SCOPE",
  message: "Forbidden.",
};

/**
 * A member with every field of the contract filled, the one of the Figma: Beatriz, of Tecnologia,
 * active, with the registration approved by Ana Paula on 01/03/2024. The instant is at 13:00 UTC on
 * purpose: the day is the same in every time zone from UTC-12 to UTC+10, so a test that reads the
 * date does not depend on the machine that runs the suite.
 */
export function buildMemberDetail(
  overrides: Partial<MemberDetailResponseDto> = {},
): MemberDetailResponseDto {
  return {
    id: MEMBER_ID,
    name: MEMBER_NAME,
    ra: "202400003",
    role: Role.member,
    accessEnabled: true,
    status: MemberStatus.active,
    registrationStatus: MemberRegistrationStatus.approved,
    birthDate: "2003-09-14",
    phone: "11991912020",
    email: "bia.nunes@email.com",
    address: "Rua Domingos de Morais, 45 — apto 32",
    city: "São Paulo",
    state: "SP",
    institutionalEmail: "beatriz.nunes@inst.edu.br",
    course: "Sistemas de Informação",
    semester: 5,
    className: "SI-2024-N",
    volunteerTermUrl: "https://drive.google.com/file/d/termo-beatriz/view",
    mainFunction: "Ministrar aulas e apoio pedagógico",
    department: { id: "01952ef7-0000-7000-8000-0000000000d1", name: "Tecnologia" },
    joinedAt: "2024-03-01",
    exitDate: null,
    exitReason: null,
    cpfMasked: "***.***.789-00",
    reviewedBy: { id: "01952ef7-0000-7000-8000-0000000000f2", name: MEMBER_APPROVER_NAME },
    reviewedAt: "2024-03-01T13:00:00.000Z",
    ...overrides,
  };
}

/**
 * The seeded coordinator opened as a member: a Person with an access profile and no member
 * profile, so every field of the member is `null` (the contract says so) and the registration has
 * no reviewer.
 */
export function buildSeedMemberDetail(
  overrides: Partial<MemberDetailResponseDto> = {},
): MemberDetailResponseDto {
  return buildMemberDetail({
    name: "Marina Albuquerque",
    ra: "a0000001",
    role: Role.coordinator,
    registrationStatus: null,
    birthDate: null,
    phone: null,
    email: null,
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
    reviewedBy: null,
    reviewedAt: null,
    ...overrides,
  });
}

interface GetMemberHandlerOptions {
  member?: MemberDetailResponseDto;
  /** Answers with the `ApiErrorDto` shape and this status instead of the member. */
  error?: ApiErrorOptions;
  /** Holds the response until the promise settles. */
  delay?: Promise<void>;
  /** Called with the id of the path every time the API is asked. */
  onCall?: (call: { id: string }) => void;
}

/**
 * `GET /members/:id`. `GET /members/me` (the profile) has the same shape of path: a test that needs
 * both registers each one with `server.use`, and the test of the profile never registers this one,
 * so `me` is never taken for an id.
 */
export function getMemberHandler({
  member = buildMemberDetail(),
  error,
  delay,
  onCall,
}: GetMemberHandlerOptions = {}) {
  return http.get("*/members/:id", async ({ params }) => {
    onCall?.({ id: String(params.id) });
    if (delay) await delay;

    if (error) {
      return HttpResponse.json(
        { statusCode: error.statusCode, error: error.error, message: error.message ?? error.error },
        { status: error.statusCode },
      );
    }
    return HttpResponse.json(member);
  });
}

/** The `StudentResponseDto` of the writes, from the detail of the same student. */
export function toStudentResponse(student: StudentDetailDto = buildStudentDetail()) {
  return {
    id: student.id,
    name: student.name,
    birthDate: student.birthDate,
    age: student.age,
    phone: student.phone,
    email: student.email,
    education: student.education,
    hasSmartphone: student.hasSmartphone,
    hasComputer: student.hasComputer,
    howFoundUs: student.howFoundUs,
    emergencyContactName: student.emergencyContact.name,
    emergencyContactPhone: student.emergencyContact.phone,
    accessibilityNeed: student.accessibilityNeed,
    classNeeds: student.classNeeds,
    supportResource: student.supportResource,
    createdAt: student.createdAt,
    createdById: student.createdBy?.id ?? "01952ef7-0000-7000-8000-0000000000f1",
    updatedAt: student.updatedAt,
    archivedAt: student.archivedAt,
    archivedById: null,
    archiveReason: student.archiveReason,
  };
}

interface StudentWriteHandlerOptions {
  error?: ApiErrorOptions & { details?: { field: string; message: string }[] };
  /** Called with the body (and the id of the path, when there is one) of every request. */
  onCall?: (call: { id?: string; body: unknown }) => void;
}

function studentWriteResponse(error: StudentWriteHandlerOptions["error"], status = 200) {
  if (error) {
    return HttpResponse.json(
      {
        statusCode: error.statusCode,
        error: error.error,
        message: error.message ?? error.error,
        ...(error.details ? { details: error.details } : {}),
      },
      { status: error.statusCode },
    );
  }
  return HttpResponse.json(toStudentResponse(), { status });
}

async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();
  return text ? (JSON.parse(text) as unknown) : undefined;
}

export function createStudentHandler({ error, onCall }: StudentWriteHandlerOptions = {}) {
  return http.post("*/students", async ({ request }) => {
    onCall?.({ body: await readBody(request) });
    return studentWriteResponse(error, 201);
  });
}

export function updateStudentHandler({ error, onCall }: StudentWriteHandlerOptions = {}) {
  return http.patch("*/students/:id", async ({ request, params }) => {
    onCall?.({ id: String(params.id), body: await readBody(request) });
    return studentWriteResponse(error);
  });
}

export function archiveStudentHandler({ error, onCall }: StudentWriteHandlerOptions = {}) {
  return http.patch("*/students/:id/archive", async ({ request, params }) => {
    onCall?.({ id: String(params.id), body: await readBody(request) });
    return studentWriteResponse(error);
  });
}

export function unarchiveStudentHandler({ error, onCall }: StudentWriteHandlerOptions = {}) {
  return http.patch("*/students/:id/unarchive", async ({ request, params }) => {
    onCall?.({ id: String(params.id), body: await readBody(request) });
    return studentWriteResponse(error);
  });
}

interface MemberWriteHandlerOptions {
  /** The member before the change; the answer is it with the fields of the body applied. */
  member?: MemberDetailResponseDto;
  error?: ApiErrorOptions & { details?: { field: string; message: string }[] };
  networkError?: boolean;
  /** Holds the response until the promise settles. */
  delay?: Promise<void>;
  /** Called with the id of the path and the body of every request. */
  onCall?: (call: { id: string; body: Record<string, unknown> }) => void;
}

function memberErrorResponse(error: NonNullable<MemberWriteHandlerOptions["error"]>) {
  return HttpResponse.json(
    {
      statusCode: error.statusCode,
      error: error.error,
      message: error.message ?? error.error,
      ...(error.details ? { details: error.details } : {}),
    },
    { status: error.statusCode },
  );
}

/**
 * `PATCH /members/:id` (Editar membro). It answers the member with what the body changed, as the
 * API does: the CPF comes back only masked and the department only by its id here.
 */
export function updateMemberHandler({
  member = buildMemberDetail(),
  error,
  networkError = false,
  delay,
  onCall,
}: MemberWriteHandlerOptions = {}) {
  return http.patch("*/members/:id", async ({ request, params }) => {
    const body = ((await readBody(request)) ?? {}) as Record<string, unknown>;
    onCall?.({ id: String(params.id), body });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return memberErrorResponse(error);
    const { cpf, departmentId, ...fields } = body;
    return HttpResponse.json({
      ...member,
      ...fields,
      ...(typeof cpf === "string"
        ? { cpfMasked: `***.***.${cpf.slice(6, 9)}-${cpf.slice(9)}` }
        : {}),
      ...(typeof departmentId === "string"
        ? { department: { id: departmentId, name: "Departamento novo" } }
        : {}),
    });
  });
}

/** `PATCH /members/:id/deactivate` (Inativar membro). It answers the member inactive. */
export function deactivateMemberHandler({
  member = buildMemberDetail(),
  error,
  networkError = false,
  delay,
  onCall,
}: MemberWriteHandlerOptions = {}) {
  return http.patch("*/members/:id/deactivate", async ({ request, params }) => {
    const body = ((await readBody(request)) ?? {}) as Record<string, unknown>;
    onCall?.({ id: String(params.id), body });
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return memberErrorResponse(error);
    return HttpResponse.json({
      ...member,
      status: MemberStatus.inactive,
      accessEnabled: false,
      exitDate: body.exitDate,
      exitReason: body.reason,
    });
  });
}
