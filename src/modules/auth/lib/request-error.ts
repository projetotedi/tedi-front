import { GATEWAY_STATUS_CODES, readApiErrorShape } from "./api-error";

export type RequestErrorKey = "network" | "unknown";

/** Erro genérico (sem campos em conflito nem código de negócio) para as telas de Acessos. */
export function toRequestErrorKey(error: unknown): RequestErrorKey {
  const { statusCode } = readApiErrorShape(error);

  if (error instanceof TypeError) return "network";
  if (typeof statusCode === "number" && GATEWAY_STATUS_CODES.has(statusCode)) return "network";
  return "unknown";
}
