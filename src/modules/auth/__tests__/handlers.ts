import { http, HttpResponse } from "msw";

import {
  InviteType,
  type AcceptInviteDto,
  type InviteResponseDto,
  type LoginDto,
  type MeResponseDto,
} from "@api/generated/model";
import { Role } from "@shared/lib/role";

/**
 * Handlers MSW escritos à mão sobre o contrato real (GET /auth/me, POST /auth/login,
 * POST /auth/logout, GET /auth/invites/:token, POST /auth/invites/accept).
 * Path com curinga de prefixo (ver http.get abaixo) porque http-client.ts prefixa a URL
 * com VITE_API_URL em runtime — o teste não precisa saber qual é o prefixo.
 */

export function buildMeUser(overrides: Partial<MeResponseDto> = {}): MeResponseDto {
  return {
    id: "01952ef7-0000-7000-8000-000000000001",
    name: "Ana Coordenadora",
    // ra/email saem tipados como objeto pelo Orval (wart do MeResponseDto do back — ver
    // risco 10 do plano de GUS-83); este card só usa id/name/role, então ficam null aqui.
    ra: null,
    email: null,
    role: Role.coordinator,
    ...overrides,
  };
}

interface MeHandlerOptions {
  /** null = 401 (anônimo). */
  user?: MeResponseDto | null;
  onCall?: () => void;
}

export function meHandler({ user = buildMeUser(), onCall }: MeHandlerOptions = {}) {
  return http.get("*/auth/me", () => {
    onCall?.();
    if (!user) {
      return HttpResponse.json({ statusCode: 401, message: "Unauthorized" }, { status: 401 });
    }
    return HttpResponse.json(user);
  });
}

export function logoutHandler(onCall?: () => void) {
  return http.post("*/auth/logout", () => {
    onCall?.();
    return new HttpResponse(null, { status: 204 });
  });
}

interface LoginHandlerOptions {
  user?: MeResponseDto;
  error?: { statusCode: number; error: string; message?: string };
  networkError?: boolean;
  delay?: Promise<void>;
  onCall?: (body: LoginDto) => void;
}

export function loginHandler({
  user = buildMeUser(),
  error,
  networkError = false,
  delay,
  onCall,
}: LoginHandlerOptions = {}) {
  return http.post("*/auth/login", async ({ request }) => {
    onCall?.((await request.json()) as LoginDto);
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) {
      return HttpResponse.json(
        { statusCode: error.statusCode, error: error.error, message: error.message ?? error.error },
        { status: error.statusCode },
      );
    }
    return HttpResponse.json(user);
  });
}

interface ApiErrorOptions {
  statusCode: number;
  error: string;
  message?: string;
}

function apiErrorResponse({ statusCode, error, message }: ApiErrorOptions) {
  return HttpResponse.json(
    { statusCode, error, message: message ?? error },
    { status: statusCode },
  );
}

export function buildInvite(overrides: Partial<InviteResponseDto> = {}): InviteResponseDto {
  return {
    type: InviteType.access,
    role: Role.member,
    expiresAt: "2026-09-22T12:00:00.000Z",
    ...overrides,
  };
}

interface GetInviteHandlerOptions {
  invite?: InviteResponseDto;
  error?: ApiErrorOptions;
  networkError?: boolean;
  delay?: Promise<void>;
  onCall?: (token: string) => void;
}

export function getInviteHandler({
  invite = buildInvite(),
  error,
  networkError = false,
  delay,
  onCall,
}: GetInviteHandlerOptions = {}) {
  return http.get("*/auth/invites/:token", async ({ params }) => {
    onCall?.(String(params.token));
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(invite);
  });
}

interface AcceptInviteHandlerOptions {
  error?: ApiErrorOptions;
  networkError?: boolean;
  delay?: Promise<void>;
  onCall?: (body: AcceptInviteDto) => void;
}

export function acceptInviteHandler({
  error,
  networkError = false,
  delay,
  onCall,
}: AcceptInviteHandlerOptions = {}) {
  return http.post("*/auth/invites/accept", async ({ request }) => {
    onCall?.((await request.json()) as AcceptInviteDto);
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return new HttpResponse(null, { status: 204 });
  });
}
