/** Status que o proxy costuma devolver enquanto a API do Render hiberna e acorda. */
export const GATEWAY_STATUS_CODES: ReadonlySet<number> = new Set([502, 503, 504]);

export interface ApiErrorShape {
  statusCode?: unknown;
  error?: unknown;
}

// Checagem estrutural: o módulo não pode importar `ApiError` de `api/http-client` (depcruise).
export function readApiErrorShape(error: unknown): ApiErrorShape {
  return typeof error === "object" && error !== null ? (error as ApiErrorShape) : {};
}
