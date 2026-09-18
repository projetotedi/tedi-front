/**
 * Único ponto de rede da aplicação. É o "mutator" usado pelo código gerado
 * pelo Orval (ver orval.config.ts). Nenhum módulo importa este arquivo
 * diretamente: quem precisa de dados usa os hooks gerados em `@api/generated`.
 *
 * Responsabilidades:
 *  - prefixar a base URL relativa `/api` (proxy Vite em dev, rewrite Vercel em prod)
 *  - enviar cookie de sessão httpOnly via `credentials: "include"`
 *  - normalizar qualquer resposta não-2xx em `ApiError`
 *  - avisar a aplicação quando a sessão expirar (401)
 */

/** Evento disparado no `window` quando a API responde 401. O módulo `auth` escuta e encerra a sessão. */
export const UNAUTHORIZED_EVENT = "tedi:unauthorized";

/** Formato de erro emitido pelo HttpExceptionFilter da API (ApiErrorDto). */
export interface ApiErrorPayload {
  statusCode: number;
  message: string;
  error?: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly error?: string;
  readonly details?: unknown;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "ApiError";
    this.statusCode = payload.statusCode;
    this.error = payload.error;
    this.details = payload.details;
  }
}

async function parseBody<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return (await response.json()) as T;
  return (await response.text()) as unknown as T;
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: ApiErrorPayload = {
    statusCode: response.status,
    message: response.statusText || "Erro ao comunicar com a API.",
  };
  try {
    const body = (await response.json()) as Partial<ApiErrorPayload>;
    payload = { ...payload, ...body, statusCode: body.statusCode ?? response.status };
  } catch {
    /* corpo não é JSON; mantém o padrão */
  }
  return new ApiError(payload);
}

/**
 * Assinatura esperada pelo Orval com `httpClient: "fetch"` + `mutator`.
 * `url` chega relativo (ex.: "/pessoas?page=1"); `options` já traz method, headers, body e signal.
 * A base URL `/api` é lida em tempo de execução para permitir substituição nos testes.
 */
export async function httpClient<T>(url: string, options: RequestInit = {}): Promise<T> {
  const apiUrl: string = import.meta.env.VITE_API_URL ?? "";
  const headers = new Headers(options.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiUrl}${url}`, { ...options, headers, credentials: "include" });

  if (response.status === 401) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }

  if (!response.ok) throw await toApiError(response);

  return parseBody<T>(response);
}

export default httpClient;
