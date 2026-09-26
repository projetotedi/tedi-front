import { http, HttpResponse } from "msw";

import {
  InviteType,
  type AcceptInviteDto,
  type AccessResponseDto,
  type CreateInviteDto,
  type CreateInviteResponseDto,
  type InviteResponseDto,
  type ListAccess200,
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

type AccessOverrides = Partial<Omit<AccessResponseDto, "ra" | "email">> & {
  /** String de verdade: o tipo `{ [key: string]: unknown }` gerado pelo Orval é um bug do Swagger. */
  ra?: string;
  email?: string;
};

/**
 * `ra`/`email` de AccessResponseDto saem tipados como `{ [key: string]: unknown }` pelo Orval
 * (o Swagger do back declara `type: object` — ver risco 10 do plano de GUS-83), mas o back de
 * verdade devolve strings. O `as unknown as` reproduz isso no mock. A tela de Acessos não
 * mostra RA nem e-mail (a busca por RA é feita pelo back), então nenhum código de tela lê os dois.
 */
export function buildAccess(overrides: AccessOverrides = {}): AccessResponseDto {
  const { ra = "2024RA0001", email = "ana@example.com", ...rest } = overrides;
  return {
    id: "01952ef7-0000-7000-8000-000000000010",
    name: "Ana Coordenadora",
    role: Role.coordinator,
    accessEnabled: true,
    ...rest,
    ra: ra as unknown as AccessResponseDto["ra"],
    email: email as unknown as AccessResponseDto["email"],
  };
}

interface ListAccessHandlerOptions {
  data?: AccessResponseDto[];
  total?: number;
  page?: number;
  limit?: number;
  error?: ApiErrorOptions;
  networkError?: boolean;
  delay?: Promise<void>;
  onCall?: (params: URLSearchParams) => void;
}

export function listAccessHandler({
  data = [buildAccess()],
  total,
  page = 1,
  // Tamanho de página da tela de Acessos (`ACCESS_PAGE_SIZE`).
  limit = 12,
  error,
  networkError = false,
  delay,
  onCall,
}: ListAccessHandlerOptions = {}) {
  return http.get("*/access", async ({ request }) => {
    onCall?.(new URL(request.url).searchParams);
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    const body: ListAccess200 = { data, page, limit, total: total ?? data.length };
    return HttpResponse.json(body);
  });
}

export function buildCreateInviteResponse(
  overrides: Partial<CreateInviteResponseDto> = {},
): CreateInviteResponseDto {
  return {
    id: "01952ef7-0000-7000-8000-000000000099",
    role: Role.member,
    expiresAt: "2026-09-24T12:00:00.000Z",
    url: "https://tedi.example/invite?token=plain-text-token",
    ...overrides,
  };
}

interface CreateInviteHandlerOptions {
  response?: CreateInviteResponseDto;
  error?: ApiErrorOptions;
  networkError?: boolean;
  delay?: Promise<void>;
  onCall?: (body: CreateInviteDto) => void;
}

// Path exato "invites" (POST): não confundir com o GET de um convite por token nem com /accept.
export function createInviteHandler({
  response = buildCreateInviteResponse(),
  error,
  networkError = false,
  delay,
  onCall,
}: CreateInviteHandlerOptions = {}) {
  return http.post("*/invites", async ({ request }) => {
    onCall?.((await request.json()) as CreateInviteDto);
    if (delay) await delay;

    if (networkError) return HttpResponse.error();
    if (error) return apiErrorResponse(error);
    return HttpResponse.json(response, { status: 201 });
  });
}
