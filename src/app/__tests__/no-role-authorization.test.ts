import { describe, expect, it } from "vitest";

/**
 * "Lint simples" do critério 8 da GUS-114: nenhum arquivo de produção libera ação comparando
 * perfil. Autorização é `RequirePermission` (rotas) e `useCan`/`can` (ações), lidos do /auth/me.
 * Mostrar o rótulo do perfil (`roles.${user.role}`) continua permitido; comparar não.
 */
const sources = import.meta.glob(
  ["/src/**/*.{ts,tsx}", "!/src/api/generated/**", "!/src/**/__tests__/**"],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\broleSatisfies\b|\bROLE_RANK\b|\bminRole\b|\brequiredRole\b/,
  /\buser\??\.role\s*[!=]==?/,
  /[!=]==?\s*user\??\.role\b/,
];

function findViolations(): string[] {
  const violations: string[] = [];
  for (const [path, content] of Object.entries(sources)) {
    content.split(/\r?\n/).forEach((line, index) => {
      if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(line))) {
        violations.push(`${path}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  return violations;
}

describe("role-based authorization", () => {
  it("scans the production sources", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20);
  });

  it("no source file gates on user.role, minRole or roleSatisfies", () => {
    expect(findViolations()).toEqual([]);
  });
});
