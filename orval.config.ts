import { defineConfig } from "orval";

/**
 * Gera a camada de integração com a API a partir do contrato OpenAPI.
 *
 * Entrada: openapi/openapi.json — cópia versionada do docs/openapi.json da tedi-back.
 * Saída:   src/api/generated/** — versionado, nunca editado à mão.
 *
 * Fluxo: quando a API muda o contrato, o workflow openapi.yml dela abre um PR
 * aqui atualizando openapi/openapi.json e rodando `yarn generate`.
 * Manualmente: copiar o arquivo e rodar `yarn generate`.
 */
export default defineConfig({
  tedi: {
    input: {
      target: "./openapi/openapi.json",
    },
    output: {
      mode: "tags-split", // um arquivo por @ApiTags da API = um por módulo do back
      target: "./src/api/generated",
      schemas: "./src/api/generated/model",
      client: "react-query",
      httpClient: "fetch",
      clean: true,
      override: {
        mutator: {
          path: "./src/api/http-client.ts",
          name: "httpClient",
        },
        query: {
          useQuery: true,
          useInfinite: false,
          signal: true,
        },
      },
    },
    hooks: {
      afterAllFilesWrite: "oxfmt",
    },
  },
  tediZod: {
    input: {
      target: "./openapi/openapi.json",
    },
    output: {
      mode: "tags-split",
      target: "./src/api/generated/zod",
      client: "zod",
      clean: true,
    },
    hooks: {
      afterAllFilesWrite: "oxfmt",
    },
  },
});
