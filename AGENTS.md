# Diretrizes do Repositório — tedi-front

## Estrutura do Projeto e Organização de Módulos

Stack: React 19 + Vite 6 + TypeScript + Tailwind CSS 4 + HeroUI (React Aria), gerenciado com Yarn. Arquitetura: **um módulo por área do domínio**, espelhando o `tedi-back`. A referência completa (estrutura, template de módulo, regras de fronteira, integração com a API) está em `docs/ARCHITECTURE.md` — leia antes de criar qualquer módulo.

```text
src/
├── main.tsx
├── app/                      composição: App, providers, router, layouts
├── api/
│   ├── http-client.ts         mutator do Orval (único ponto de rede)
│   ├── query-client.ts
│   └── generated/             GERADO pelo Orval — não editar
├── modules/<modulo>/         um por módulo do back (auth, pessoas, turmas, aulas, ...)
│   ├── index.ts               API pública do módulo
│   ├── routes.tsx  pages/  components/  hooks/  schemas/  locales/
│   └── __tests__/
└── shared/                   ui/  components/  hooks/  i18n/  lib/  (sem domínio)
```

Aliases: `@app/*`, `@api/*`, `@modules/*`, `@shared/*` (ver `tsconfig.json`). Dentro de um módulo, import relativo; entre módulos, só `@modules/<m>` (o `index.ts`).

`dist/` (gerado por `vite build`) não se edita à mão. `src/api/generated/` é gerado por `yarn generate` a partir de `openapi/openapi.json`.

## Comandos de Build, Teste e Desenvolvimento

Use Yarn.

- `yarn install`: instala dependências.
- `yarn dev`: sobe o Vite em modo desenvolvimento.
- `yarn build`: `tsc --noEmit && vite build`.
- `yarn typecheck`: só o `tsc --noEmit`.
- `yarn preview`: serve o build de produção localmente.
- `yarn test` / `yarn test:watch` / `yarn test:cov`: Vitest.
- `yarn lint`: oxlint. `yarn format` / `yarn format:check`: oxfmt.
- `yarn depcruise`: verifica as regras de fronteira entre módulos (`.dependency-cruiser.cjs`).
- `yarn generate`: roda o Orval. Exige `openapi/openapi.json` (copiado de `docs/openapi.json` da API).

## Estilo de Código e Convenções de Nomenclatura

- Linter: oxlint com plugins `react` e `typescript` (`.oxlintrc.json`), ambiente browser + ES2022. `src/api/generated` é ignorado.
- Formatter: oxfmt.
- TypeScript em modo `strict`, com `noUnusedLocals`, `noUnusedParameters` e `noFallthroughCasesInSwitch`.
- Pastas de módulo em minúsculo, nome igual ao do back (`pessoas`, `turmas`). Componentes e páginas em PascalCase (`PessoaForm.tsx`, `PessoasListPage.tsx`). Hooks em camelCase com prefixo `use`. Demais arquivos em kebab-case (`http-client.ts`).
- Nomes de domínio em português, termos técnicos em inglês.

## Regras do Projeto

- **Nenhuma chamada HTTP escrita à mão.** Componentes e páginas usam os hooks gerados em `@api/generated/<modulo>`. `fetch`/`axios` direto e import de `@api/http-client` fora de `src/api/` são proibidos (o `depcruise` falha).
- **Nenhum tipo de resposta da API escrito à mão.** Vem de `@api/generated/model`. Se falta algo, o problema é no Swagger da API, não aqui.
- **Módulo é caixa fechada.** Só o `index.ts` é público. Importar `@modules/x/components/...` de outro módulo falha no CI.
- **Formulários** usam `react-hook-form` + `zodResolver`. O schema vem de `@api/generated/zod/<modulo>`; só crie schema próprio em `schemas/` quando o formulário difere do DTO (campo condicional, máscara).
- **Rotas** são declaradas em `routes.tsx` de cada módulo e concatenadas em `src/app/router.tsx`. Sem roteamento paralelo dentro de páginas.
- **Textos de interface** usam `react-i18next`, um namespace por módulo registrado com `registerModuleLocales` no `index.ts`. Nunca hardcodar string visível ao usuário.
- **`shared/` não conhece domínio.** Se um componente precisa de um conceito do TEDI, ele pertence a um módulo.
- **Acessibilidade** (público idoso): fonte base 16px, alvos de toque 44px, contraste 4.5:1, foco visível, rótulos em todo input. Vale para tudo, com rigor extra em `PublicLayout`.

## Diretrizes de Teste

- Vitest + Testing Library (`vitest.setup.ts` carrega o jest-dom). Arquivos `*.test.ts(x)` em `__tests__/` do módulo ou de `shared/<x>/`.
- Renderizar componentes com os providers que precisam (`QueryClientProvider`, `MemoryRouter`); asserções por papel e texto acessível, não por classe CSS.
- Rede: MSW. Quando o primeiro módulo existir, habilitar `mock: true` no Orval para gerar os handlers a partir do contrato.

### Restrições de Execução para Agentes

- Ao iterar, rode só o teste do arquivo alterado (`yarn test <caminho>`); antes do PR, `yarn lint`, `yarn format:check`, `yarn typecheck`, `yarn depcruise`, `yarn test`, `yarn build`.
- Nunca edite `src/api/generated/`. Se o contrato mudou, atualize `openapi/openapi.json` e rode `yarn generate`.

## Diretrizes de Commit e Pull Request

- Fluxo de branches: `feature/* → develop → staging → main`. O CI (`.github/workflows/ci.yml`) roda em push/PR para `main`, `staging` e `develop`: install → lint → format:check → typecheck → depcruise → test → build.
- Usar o template em `.github/pull_request_template.md` (em português): Resumo, Impacto funcional, Migração (normalmente "Não houve migration" neste repo), Validações, Observações.

## Dicas de Segurança e Configuração

- Não commitar `.env`. Usar `.env.example` como referência (`VITE_API_URL`).
- Deploy: Vercel, configurado em `vercel.json` (SPA rewrite, headers, cache). `VITE_API_URL` é definida no painel do Vercel por ambiente e resolvida no build. Passo a passo em `docs/DEPLOY.md`.
- A sessão é mantida por cookie httpOnly emitido pelo back. `src/api/http-client.ts` envia `credentials: "include"` em todo request; não há token em `localStorage`.
- Para rodar contra a API local: `tedi-back` em `http://localhost:3000` (ver README daquele repositório).

## Skills e agentes do repositório

- `.claude/skills/do-task/` — esteira de execução de uma issue do Linear: conectores → leitura do card e do plano de produto → branch `<tipo>/GUS-<n>-<slug>` → plano (agente `tedi-planner`) aprovado pelo humano → implementação (`tedi-dev`) → revisão (`tedi-reviewer`) → revisão manual no CRIT → PR para `develop` com assignee e labels. Invocar com `/do-task GUS-<n>`. Pré-requisitos: MCP do Linear, credencial do GitHub com acesso à org e o binário `crit` (a etapa 0 da skill confere e explica).
- `.claude/agents/tedi-*.md` — definições dos agentes (modelo e esforço fixos por papel). Não alterar o esforço por conveniência; mudar aqui muda para todo o time.
- As skills de planejamento (`plan-feature`, `create-task`) ficam no ambiente de quem planeja, não no repositório.

## Artefatos do Agente

Use `AGENTS.md` como ponto de entrada compartilhado para todos os agentes de IA.
Mantenha os arquivos do agente em `.agents/` e evite diretórios específicos de fornecedor.

- Conhecimento persistente (versionado) → `.agents/memory/`.
- Prompts reutilizáveis (versionado) → `.agents/prompts/`.
- Artefatos temporários (não versionado) → `.agents/artifacts/`.
- Não crie artefatos markdown na raiz do repositório, a menos que explicitamente solicitado. Documentação de arquitetura vai em `docs/`.
