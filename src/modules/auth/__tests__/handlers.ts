import { http, HttpResponse } from "msw";

import type { MeResponseDto } from "@api/generated/model";
import { Role } from "@shared/lib/role";

/**
 * Handlers MSW escritos à mão sobre o contrato real (GET /auth/me, POST /auth/logout).
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
