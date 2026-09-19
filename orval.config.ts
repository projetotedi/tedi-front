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
        // useQuery/useMutation ficam no padrão do Orval (GET => useQuery, demais verbos =>
        // useMutation): não forçar `useQuery: true` aqui, senão POST/PUT/DELETE também viram
        // query hooks (sem mutateAsync) em vez de mutation hooks.
        query: {
          useInfinite: false,
          signal: true,
        },
        // O mutator (`httpClient`) devolve o corpo já parseado (T) e lança ApiError em
        // respostas não-2xx — não o envelope { data, status, headers } que é o padrão do
        // Orval para o client "fetch". Sem isso, os tipos gerados (ex.: MeResponse) não
        // batem com o que o mutator realmente devolve em runtime.
        fetch: {
          includeHttpResponseReturnType: false,
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
