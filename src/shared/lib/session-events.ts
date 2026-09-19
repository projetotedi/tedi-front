/**
 * Espelho de UNAUTHORIZED_EVENT em src/api/http-client.ts.
 * Duplicado de propósito: `api/` não pode importar `shared/` (.dependency-cruiser.cjs)
 * e módulos não podem importar o mutator. src/shared/lib/__tests__/session-events.test.ts
 * garante que os dois valores não divirjam.
 */
export const UNAUTHORIZED_EVENT = "tedi:unauthorized";
