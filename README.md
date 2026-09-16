# tedi-front

Frontend do TEDI — sistema de gestão do projeto de extensão (pessoas, turmas, aulas, alocação de voluntários e banco de horas).

Stack: React 19 + Vite 6 + TypeScript + Tailwind CSS 4 + HeroUI (React Aria), Yarn. Integração com a API gerada pelo Orval.

## Rodando localmente

```bash
cp .env.example .env        # VITE_API_URL=http://localhost:3000
yarn install
yarn dev                    # http://localhost:5173
```

Para consumir a API, copie o `docs/openapi.json` do `tedi-back` para `openapi/openapi.json` e rode `yarn generate`.

## Comandos

| Comando                                              | O que faz                                                        |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| `yarn dev`                                           | sobe o Vite                                                      |
| `yarn test`                                          | Vitest                                                           |
| `yarn lint` / `yarn format:check` / `yarn typecheck` | qualidade                                                        |
| `yarn depcruise`                                     | regras de fronteira entre módulos                                |
| `yarn generate`                                      | regenera `src/api/generated/` a partir de `openapi/openapi.json` |
| `yarn build`                                         | compila para `dist/`                                             |

## Arquitetura

Um módulo por área do domínio em `src/modules/`, com os mesmos nomes do back. Integração com a API em `src/api/` (gerada). Genérico em `src/shared/`. Detalhes, template de módulo e regras em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Convenções para quem contribui (humano ou agente) em [`AGENTS.md`](AGENTS.md).
