/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "modulo-nao-importa-interno-de-outro-modulo",
      comment:
        "Entre módulos, só a raiz (index.ts) é pública. Exporte o que precisar no index.ts do módulo dono.",
      severity: "error",
      from: { path: "^src/modules/([^/]+)/" },
      to: {
        path: "^src/modules/([^/]+)/.+",
        pathNot: ["^src/modules/$1/", "^src/modules/[^/]+/index\\.ts$"],
      },
    },
    {
      name: "shared-nao-conhece-dominio",
      comment: "shared/ e app/layouts não podem depender de módulos de domínio.",
      severity: "error",
      from: { path: "^src/shared/" },
      to: { path: "^src/modules/" },
    },
    {
      name: "api-nao-conhece-dominio",
      severity: "error",
      from: { path: "^src/api/" },
      to: { path: "^src/(modules|app|shared)/" },
    },
    {
      name: "so-api-usa-http-client",
      comment: "Módulos consomem os hooks gerados em src/api/generated, nunca o mutator direto.",
      severity: "error",
      from: { pathNot: "^src/api/" },
      to: { path: "^src/api/http-client\\.ts$" },
    },
    {
      name: "sem-dependencia-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "sem-orfaos",
      severity: "warn",
      from: { orphan: true, pathNot: ["\\.d\\.ts$", "\\.gitkeep$", "vitest\\.setup\\.ts$"] },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    // "/__tests__/" (em vez de só "\.test\.tsx?$") para que helpers de teste sem sufixo
    // .test (handlers.ts, test-utils.tsx) também fiquem de fora das fronteiras: eles não
    // são órfãos nem participam das regras entre módulos, só servem aos próprios testes.
    exclude: { path: ["^src/api/generated/", "/__tests__/"] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types", "typings"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
