/**
 * Único ponto de rede da aplicação. É o "mutator" usado pelo código gerado
 * pelo Orval (ver orval.config.ts). Nenhum módulo importa este arquivo
 * diretamente: quem precisa de dados usa os hooks gerados em `@api/generated`.
 *
 * Responsabilidades:
 *  - prefixar a base URL da API
 *  - enviar o bearer token da sessão
 *  - normalizar qualquer resposta não-2xx em `ErroApi`
 *  - avisar a aplicação quando a sessão expirar (401)
 */

const API_URL: string = import.meta.env.VITE_API_URL ?? "";

const TOKEN_STORAGE_KEY = "tedi.token";

/** Evento disparado no `window` quando a API responde 401. O módulo `auth` escuta e encerra a sessão. */
export const UNAUTHORIZED_EVENT = "tedi:unauthorized";

/** Formato de erro emitido pelo HttpExceptionFilter da API (ErroApiDto). */
export interface ErroApiPayload {
  statusCode: number;
  message: string;
  error?: string;
  details?: unknown;
}

export class ErroApi extends Error {
  readonly statusCode: number;
  readonly error?: string;
  readonly details?: unknown;

  constructor(payload: ErroApiPayload) {
    super(payload.message);
    this.name = "ErroApi";
    this.statusCode = payload.statusCode;
    this.error = payload.error;
    this.details = payload.details;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* storage indisponível (modo privado, etc.) */
  }
}

async function parseBody<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return (await response.json()) as T;
  return (await response.text()) as unknown as T;
}

async function toErroApi(response: Response): Promise<ErroApi> {
  let payload: ErroApiPayload = {
    statusCode: response.status,
    message: response.statusText || "Erro ao comunicar com a API.",
  };
  try {
    const body = (await response.json()) as Partial<ErroApiPayload>;
    payload = { ...payload, ...body, statusCode: body.statusCode ?? response.status };
  } catch {
    /* corpo não é JSON; mantém o padrão */
  }
  return new ErroApi(payload);
}

/**
 * Assinatura esperada pelo Orval com `httpClient: "fetch"` + `mutator`.
 * `url` chega relativo (ex.: "/pessoas?page=1"); `options` já traz method, headers, body e signal.
 */
export async function httpClient<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = getToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${url}`, { ...options, headers });

  if (response.status === 401) {
    setToken(null);
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }

  if (!response.ok) throw await toErroApi(response);

  return parseBody<T>(response);
}

export default httpClient;
