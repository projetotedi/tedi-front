import { GATEWAY_STATUS_CODES, readApiErrorShape } from "./api-error";

export type RequestErrorKey = "network" | "unknown";

export function toRequestErrorKey(error: unknown): RequestErrorKey {
  const { statusCode } = readApiErrorShape(error);

  if (error instanceof TypeError) return "network";
  if (typeof statusCode === "number" && GATEWAY_STATUS_CODES.has(statusCode)) return "network";
  return "unknown";
}
