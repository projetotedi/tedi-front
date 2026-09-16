# tedi-front

Frontend do TEDI — sistema de gestão do projeto de extensão (pessoas, turmas, aulas, alocação de voluntários e banco de horas).

Stack: React 19 + Vite 6 + TypeScript + Tailwind CSS 4 + HeroUI (React Aria), Yarn 1. Integração com a API gerada pelo Orval.

## Rodando localmente

Pré-requisitos: **Node 22+** e **Yarn 1** (`corepack enable` ou `npm i -g yarn`). O front não tem banco nem migrations: tudo isso mora na API.

### 1. Subir a API

O front precisa do `tedi-back` rodando. Siga o README dele; em resumo, na pasta do back:

```bash
docker compose up -d && cp .env.example .env && yarn install && yarn migration:run && yarn dev
```

A API fica em `http://localhost:3000` e já aceita o front local no CORS.

Sem vontade de subir o back? Aponte `VITE_API_URL` para a API no ar, `https://tedi-back.onrender.com`. O CORS dela não aceita `localhost`, então isso serve só para ver a tela, não para chamar a API.

### 2. Subir o front

```bash
git clone https://github.com/projetotedi/tedi-front.git
cd tedi-front

cp .env.example .env        # VITE_API_URL=http://localhost:3000
yarn install
yarn dev                    # http://localhost:5173, com hot reload
```

### 3. Gerar o cliente da API (quando o contrato mudar)

Tipos, hooks e schemas de validação não são escritos à mão: o Orval gera tudo em `src/api/generated/` a partir do contrato OpenAPI da API.

```bash
# na pasta do back, com a API compilada:
yarn openapi:export                       # gera docs/openapi.json  (script previsto na fundação)

# na pasta do front:
cp ../tedi-back/docs/openapi.json openapi/openapi.json
yarn generate                             # regenera src/api/generated/
```

Commite o `openapi/openapi.json` e o `src/api/generated/` junto com a tela que usa o endpoint novo. Se depois do `generate` o `yarn typecheck` quebrar, é a API avisando que o contrato mudou.

Enquanto a API ainda não publica o `openapi.json`, `openapi/` fica vazio e o `yarn generate` não roda.

## Comandos

| Comando                                           | O que faz                                                        |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `yarn dev`                                        | sobe o Vite em `localhost:5173`                                  |
| `yarn test` / `yarn test:watch` / `yarn test:cov` | Vitest                                                           |
| `yarn lint` / `yarn format` / `yarn format:check` | qualidade                                                        |
| `yarn typecheck`                                  | `tsc --noEmit`                                                   |
| `yarn depcruise`                                  | regras de fronteira entre módulos                                |
| `yarn generate`                                   | regenera `src/api/generated/` a partir de `openapi/openapi.json` |
| `yarn build`                                      | compila para `dist/`                                             |
| `yarn preview`                                    | serve o build de produção em `localhost:4173`                    |

Antes de abrir PR: `yarn lint && yarn format:check && yarn typecheck && yarn depcruise && yarn test && yarn build`, que é o que o CI roda.

## Variáveis de ambiente

| Variável       | Local                   | Produção (Vercel)                |
| -------------- | ----------------------- | -------------------------------- |
| `VITE_API_URL` | `http://localhost:3000` | `https://tedi-back.onrender.com` |

É resolvida no build: mudou a URL, é preciso reiniciar o `yarn dev` ou fazer redeploy.

## Arquitetura

Um módulo por área do domínio em `src/modules/`, com os mesmos nomes do back. Integração com a API em `src/api/` (gerada). Genérico em `src/shared/`. Detalhes, template de módulo e regras em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Convenções para quem contribui (humano ou agente) em [`AGENTS.md`](AGENTS.md). Deploy (Vercel) em [`docs/DEPLOY.md`](docs/DEPLOY.md).
