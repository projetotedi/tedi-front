import { http, HttpResponse } from "msw";

import {
  MemberRegistrationStatus,
  type ApiFieldErrorDto,
  type ApproveMemberRegistrationDto,
  type DepartmentResponseDto,
  type MemberRegistrationResponseDto,
  type RejectMemberRegistrationDto,
} from "@api/generated/model";
import { Role } from "@shared/lib/role";

/**
 * Handlers MSW escritos à mão sobre o contrato real da validação de cadastro (GUS-125):
 * GET /member-registrations/:id, PATCH /member-registrations/:id/approve|reject e GET /departments.
 * Ficam num arquivo próprio para não mexer em `handlers.ts`, que outras tarefas também editam.
 */

export const REGISTRATION_ID = "01952ef7-0000-7000-8000-0000000000c1";
export const REVIEWER_ID = "01952ef7-0000-7000-8000-000000000001";
export const SUBMITTED_AT = "2026-09-18T17:32:00.000Z";
export const REVIEWED_AT = "2026-09-19T12:00:00.000Z";

export const REVIEW_DEPARTMENTS: DepartmentResponseDto[] = [
  { id: "01952ef7-0000-7000-8000-0000000000d1", name: "Pedagogia" },
  { id: "01952ef7-0000-7000-8000-0000000000d2", name: "Tecnologia" },
];

const TECHNOLOGY = REVIEW_DEPARTMENTS[1];

/** O cadastro de Lucas, pendente, como o back o devolve ao abrir a validação. */
export function buildMemberRegistration(
  overrides: Partial<MemberRegistrationResponseDto> = {},
): MemberRegistrationResponseDto {
  return {
    id: REGISTRATION_ID,
    name: "Lucas Andrade Souza",
    ra: "202600117",
    cpf: "52998224725",
    phone: "11981813030",
    birthDate: "2004-05-22",
    personalEmail: "lucas.souza@example.com",
    institutionalEmail: "lucas.souza@aluno.example.edu.br",
    address: "Rua das Flores, 120, apto 4",
    city: "Campinas",
    state: "SP",
    course: "Sistemas de Informação",
    semester: 3,
    className: "SI 3A",
    department: TECHNOLOGY,
    volunteerTermUrl: "https://drive.google.com/file/d/termo-lucas/view",
    requestedRole: Role.member,
    registrationStatus: MemberRegistrationStatus.pending,
    submittedAt: SUBMITTED_AT,
    mainFunction: null,
    joinedAt: null,
    role: null,
    accessEnabled: false,
    reviewNote: null,
    reviewedAt: null,
    reviewedById: null,
    createdAt: SUBMITTED_AT,
    updatedAt: SUBMITTED_AT,
    ...overrides,
  };
}

export interface ReviewApiError {
  statusCode: number;
  error: string;
  message?: string;
  details?: ApiFieldErrorDto[];
}

/** Erro do back (`ApiErrorDto`): o código vai em `error`, e `details` só no VALIDATION_FAILED. */
export function reviewError(
  statusCode: number,
  error: string,
  details?: ApiFieldErrorDto[],
): ReviewApiError {
  return { statusCode, error, message: error, details };
}

function apiErrorResponse({ statusCode, error, message, details }: ReviewApiError) {
  return HttpResponse.json(
    { statusCode, error, message: message ?? error, ...(details ? { details } : {}) },
    { status: statusCode },
  );
}

interface HandlerOptions {
  error?: ReviewApiError;
  networkError?: boolean;
  /** Segura a resposta até a promessa resolver: deixa o teste olhar a tela "enviando". */
  delay?: Promise<void>;
}

interface GetRegistrationOptions extends HandlerOptions {
  registration?: MemberRegistrationResponseDto;
  onCall?: (id: string) => void;
}

export function getMemberRegistrationHandler({
  registration = buildMemberRegistration(),
  error,
  networkError = false,
  delay,
  onCall,
}: GetRegistrationOptions = {}) {
  return http.get("*/member-registrations/:id", async ({ params }) => {
    onCall?.(String(params.id));
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(registration);
  });
}

/** O que o back devolve depois de aprovar: perfil, departamento, função e entrada decididos. */
export function buildApprovedRegistration(
  id: string,
  body: ApproveMemberRegistrationDto,
): MemberRegistrationResponseDto {
  return buildMemberRegistration({
    id,
    registrationStatus: MemberRegistrationStatus.approved,
    accessEnabled: true,
    role: body.role,
    department:
      REVIEW_DEPARTMENTS.find((department) => department.id === body.departmentId) ?? null,
    mainFunction: body.mainFunction,
    joinedAt: body.joinedAt,
    reviewNote: body.note ?? null,
    reviewedAt: REVIEWED_AT,
    reviewedById: REVIEWER_ID,
    updatedAt: REVIEWED_AT,
  });
}

/** O que o back devolve depois de recusar: sem perfil, sem acesso e com a observação. */
export function buildRejectedRegistration(
  id: string,
  body: RejectMemberRegistrationDto,
): MemberRegistrationResponseDto {
  return buildMemberRegistration({
    id,
    registrationStatus: MemberRegistrationStatus.rejected,
    accessEnabled: false,
    role: null,
    reviewNote: body.note,
    reviewedAt: REVIEWED_AT,
    reviewedById: REVIEWER_ID,
    updatedAt: REVIEWED_AT,
  });
}

interface ApproveHandlerOptions extends HandlerOptions {
  response?: MemberRegistrationResponseDto;
  onCall?: (id: string, body: ApproveMemberRegistrationDto) => void;
}

export function approveMemberRegistrationHandler({
  response,
  error,
  networkError = false,
  delay,
  onCall,
}: ApproveHandlerOptions = {}) {
  return http.patch("*/member-registrations/:id/approve", async ({ request, params }) => {
    const id = String(params.id);
    const body = (await request.json()) as ApproveMemberRegistrationDto;
    onCall?.(id, body);
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response ?? buildApprovedRegistration(id, body));
  });
}

interface RejectHandlerOptions extends HandlerOptions {
  response?: MemberRegistrationResponseDto;
  onCall?: (id: string, body: RejectMemberRegistrationDto) => void;
}

export function rejectMemberRegistrationHandler({
  response,
  error,
  networkError = false,
  delay,
  onCall,
}: RejectHandlerOptions = {}) {
  return http.patch("*/member-registrations/:id/reject", async ({ request, params }) => {
    const id = String(params.id);
    const body = (await request.json()) as RejectMemberRegistrationDto;
    onCall?.(id, body);
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response ?? buildRejectedRegistration(id, body));
  });
}

interface ListDepartmentsOptions extends HandlerOptions {
  data?: DepartmentResponseDto[];
  onCall?: () => void;
}

export function listDepartmentsHandler({
  data = REVIEW_DEPARTMENTS,
  error,
  networkError = false,
  delay,
  onCall,
}: ListDepartmentsOptions = {}) {
  return http.get("*/departments", async () => {
    onCall?.();
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(data);
  });
}
