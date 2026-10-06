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

const ROLE_VALUE = String.raw`(?:Role\.\w+|["'](?:member|director|coordinator|superadmin)["'])`;

const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  // Hierarquia de perfil que a GUS-114 removeu.
  /\broleSatisfies\b|\bROLE_RANK\b|\bminRole\b|\brequiredRole\b/,
  // `user.role === ...` e o inverso.
  /\buser\??\.role\s*[!=]==?/,
  /[!=]==?\s*user\??\.role\b/,
  // Qualquer comparação com um valor de perfil, seja qual for a variável (`role`, `me.role`, `data?.role`).
  new RegExp(String.raw`[!=]==?\s*${ROLE_VALUE}`),
  new RegExp(String.raw`${ROLE_VALUE}\s*[!=]==?`),
  // `switch (...) { case Role.x: }`.
  /\bcase\s+Role\./,
  // `[Role.a, Role.b].includes(x.role)` e `includes(user.role)`.
  /\bincludes\([^)]*\.role\b/,
  new RegExp(String.raw`\[[^\]]*${ROLE_VALUE}[^\]]*\]\.includes\(`),
];

/**
 * Arquivos que comparam perfil só para EXIBIÇÃO (tom do badge, rótulo do convite), nunca para
 * liberar ação. Entrada nova aqui exige justificativa no PR: ação é `useCan`.
 */
const DISPLAY_ONLY_ALLOWLIST: readonly string[] = [
  // `roleBadgeTone`: cor do badge de perfil na tabela de acessos.
  "/src/modules/auth/lib/role-label.ts",
  // `roleLabelKey`: chave de i18n do perfil do convite (superadmin não tem rótulo).
  "/src/modules/auth/components/AcceptInviteForm.tsx",
];

function matchesForbidden(line: string): boolean {
  return FORBIDDEN_PATTERNS.some((pattern) => pattern.test(line));
}

function findViolations(): string[] {
  const violations: string[] = [];
  for (const [path, content] of Object.entries(sources)) {
    if (DISPLAY_ONLY_ALLOWLIST.includes(path)) continue;
    content.split(/\r?\n/).forEach((line, index) => {
      if (matchesForbidden(line)) violations.push(`${path}:${index + 1}: ${line.trim()}`);
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

  it("allowlisted files exist and still compare a role (remove the entry when they stop)", () => {
    for (const path of DISPLAY_ONLY_ALLOWLIST) {
      const content = sources[path];
      expect(content, path).toBeDefined();
      expect(content!.split(/\r?\n/).some(matchesForbidden), path).toBe(true);
    }
  });

  it.each([
    "if (roleSatisfies(user.role, minRole)) return true;",
    "const rank = ROLE_RANK[user.role];",
    "if (user.role === Role.coordinator) show();",
    'if (user?.role !== "member") show();',
    "if (Role.coordinator === user.role) show();",
    "const { role } = user; if (role === Role.coordinator) show();",
    'if (me.role === "coordinator") show();',
    "if (data?.role === Role.coordinator) show();",
    "if (user!.role === Role.member) hide();",
    "switch (user.role) { case Role.member: break; }",
    "if ([Role.coordinator, Role.director].includes(user.role)) show();",
    "if (allowed.includes(user.role)) show();",
    "if (['coordinator', 'director'].includes(role)) show();",
    "const isAdmin = role !== Role.member;",
  ])("catches the forbidden snippet: %s", (snippet) => {
    expect(matchesForbidden(snippet)).toBe(true);
  });

  it.each([
    "const label = t(`roles.${user.role}`, { ns: 'common' });",
    "const INVITABLE_ROLES = [Role.member, Role.director] as const;",
    "[Role.member]: 'invite.roles.member',",
  ])("does not flag display code: %s", (snippet) => {
    expect(matchesForbidden(snippet)).toBe(false);
  });
});
