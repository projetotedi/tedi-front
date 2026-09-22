# Arquitetura — tedi-front

Frontend do TEDI organizado **por módulo de domínio**, espelhando o `tedi-back`. Este documento é a referência de **onde cada coisa mora** e **quem pode depender de quem**. As regras de fronteira são verificadas no CI por `dependency-cruiser`.

## 1. Princípios

1. **Mesmo mapa do back.** Cada pasta em `src/modules/` tem o nome de um módulo da API (`pessoas`, `turmas`, `aulas`...). Quem lê o Linear, o back ou o front vê os mesmos nomes.
2. **Módulo é uma caixa fechada.** Só o que está no `index.ts` do módulo pode ser importado por outro módulo ou pelo `app/`.
3. **Ninguém escreve código de integração.** Tipos, funções de chamada, hooks de dados e schemas Zod são gerados pelo **Orval** a partir do `openapi.json` da API. Módulos só têm interface e regras de tela.
4. **`shared/` não conhece domínio.** Componentes de interface, hooks genéricos, i18n, utilitários.
5. **Testes vivem dentro do módulo**, em `__tests__/`.

## 2. Estrutura de pastas

```
src/
├── main.tsx
├── app/                              # composição da aplicação, sem domínio
│   ├── App.tsx
│   ├── providers.tsx                 # QueryClientProvider (+ sessão, quando auth existir)
│   ├── router.tsx                    # concatena as rotas exportadas por cada módulo
│   ├── layouts/
│   │   ├── AppLayout.tsx             # área autenticada: menu por perfil
│   │   └── PublicLayout.tsx          # login e formulário público (acessibilidade reforçada)
│   └── pages/InicioPage.tsx          # provisório até o módulo auth existir
│
├── api/                              # fronteira com o back
│   ├── http-client.ts                # mutator do Orval: base URL /api, cookie de sessão, 401, ApiError
│   ├── query-client.ts               # QueryClient com defaults (retry, staleTime)
│   └── generated/                    # Orval. Versionado. Ninguém edita à mão.
│       ├── model/                    # todos os DTOs
│       ├── <tag>/<tag>.ts            # hooks + funções por @ApiTags da API (= módulo do back)
│       └── zod/<tag>/<tag>.ts        # schemas Zod dos DTOs
│
├── modules/                          # um por módulo do back, mesmo nome
│   ├── auth/  pessoas/  importacao/  turmas/  aulas/  alocacoes/
│   ├── presencas/  horas/  relatorios/  auditoria/
│   └── <modulo>/                     # ver template abaixo
│
└── shared/                           # genérico, sem domínio
    ├── ui/                           # Button, TextField, PasswordField, Alert, Skeleton, Stepper, StatusCard, Select, Tabs, Dialog, Badge (acessíveis); Toast ainda não existe (§8.2)
    ├── components/                   # PageTitle, DataTable, EmptyState, ConfirmDialog
    ├── hooks/                        # useDocumentTitle, useDebounce...
    ├── i18n/                         # init do i18next + registerModuleLocales + locales/common
    └── lib/                          # datas, formatação, cn()
```

Fora de `src/`: `openapi/openapi.json` (cópia versionada do contrato da API), `orval.config.ts`, `vitest.setup.ts`, `.dependency-cruiser.cjs`.

Aliases: `@app/*`, `@api/*`, `@modules/*`, `@shared/*`.

### 2.1 Template de um módulo

```
modules/pessoas/
├── index.ts                  # API pública: routes + o que outros módulos podem usar
├── routes.tsx                # RouteObject[] do módulo, com RequireRole
├── pages/
│   ├── PessoasListPage.tsx
│   ├── AlunoFormPage.tsx
│   └── MembroFormPage.tsx
├── components/
│   ├── PessoaForm.tsx
│   ├── PessoasTable.tsx
│   └── AlertaDuplicidade.tsx
├── hooks/                    # composição de hooks gerados + estado de tela
├── schemas/                  # Zod só quando o formulário difere do DTO (campo condicional, máscara)
├── locales/
│   ├── pt-BR.json            # namespace "pessoas"
│   └── en-US.json
└── __tests__/
    ├── PessoaForm.test.tsx
    └── PessoasListPage.test.tsx
```

O que **não** existe dentro do módulo: `services/`, `types/`, `api/`. Tudo isso vem de `@api/generated/<modulo>`.

## 3. Como as peças se conectam

**Rotas.** Cada módulo declara as suas; o `app/router.tsx` só concatena. `lazy` dá um chunk por módulo sem configuração extra.

```tsx
// modules/pessoas/routes.tsx
import { Role } from "@shared/lib/role";

export const pessoasRoutes: RouteObject[] = [
  {
    path: "pessoas",
    element: <RequireRole minRole={Role.director} />,
    children: [
      { index: true, lazy: () => import("./pages/PessoasListPage") },
      { path: "alunos/novo", lazy: () => import("./pages/AlunoFormPage") },
    ],
  },
];
```

Um módulo pode exportar mais de um array de rotas quando parte é pública e parte exige sessão —
`auth` faz isso: `authRoutes` (login, convite) fica sob `PublicLayout`, `authProtectedRoutes`
(hoje só `/access`) fica sob `AppLayout`, e `app/router.tsx` concatena os dois em lugares
diferentes. `lazy` no código de verdade devolve `{ Component }`, e não o módulo inteiro:

```tsx
lazy: async () => {
  const { AccessPage } = await import("./pages/AccessPage");
  return { Component: AccessPage };
},
```

**Dados.** Hook, tipo dos filtros e tipo da resposta vêm do Orval. Nenhum `fetch` em componente.

```tsx
import { useListarPessoas, type ListarPessoasParams } from "@api/generated/pessoas/pessoas";

const { data, isLoading } = useListarPessoas(params);
```

**Formulários.** React Hook Form + `zodResolver` com o schema gerado. Validação no front e no back saem do mesmo DTO.

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCriarPessoa, getListarPessoasQueryKey } from "@api/generated/pessoas/pessoas";
import { criarPessoaDtoSchema } from "@api/generated/zod/pessoas/pessoas";

const form = useForm<CriarPessoaDto>({ resolver: zodResolver(criarPessoaDtoSchema) });
const criar = useCriarPessoa({
  mutation: {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getListarPessoasQueryKey() }),
  },
});
```

**API pública do módulo.** Equivalente ao `exports` do `@Module` no Nest.

```ts
// modules/pessoas/index.ts
export { pessoasRoutes } from "./routes";
export { SeletorPessoa } from "./components/SeletorPessoa"; // usado por turmas e alocacoes
```

`turmas` importa `SeletorPessoa` de `@modules/pessoas`, nunca de `@modules/pessoas/components/...`.

**i18n.** Um namespace por módulo, registrado com `registerModuleLocales("pessoas", { "pt-BR": ptBR, "en-US": enUS })` no `index.ts` do módulo. Nos componentes, `useTranslation("pessoas")`.

**Sessão.** `http-client.ts` envia todas as requisições com `credentials: "include"` para que o browser inclua o cookie httpOnly de sessão. Ao receber 401, dispara o evento de `window` `tedi:unauthorized` (`api/` nunca importa `modules/`, então a constante é duplicada de propósito em `shared/lib/session-events.ts`, com um teste garantindo que as duas não divirjam).

O módulo `@modules/auth` (GUS-83) é o dono da sessão no front e expõe:

```ts
type AuthStatus = "loading" | "authenticated" | "anonymous";
interface AuthContextValue {
  status: AuthStatus;
  user: MeResponseDto | null;
  signOut: () => Promise<void>;
}

function AuthProvider(props: { children?: ReactNode }): ReactElement; // sem children, renderiza <Outlet />
function useAuth(): AuthContextValue;
function RequireRole(props: { minRole?: Role; children?: ReactNode }): ReactElement;
function SignOutButton(): ReactElement | null;
const authRoutes: RouteObject[]; // rotas públicas do módulo (hoje: "login", "invite" e "reset-password")
const authProtectedRoutes: RouteObject[]; // rotas autenticadas do módulo (hoje: "access", sob RequireRole minRole={Role.coordinator})
```

`AuthProvider` carrega a sessão com `GET /auth/me` uma única vez (`staleTime: Infinity`) e entra como rota-layout raiz de `app/router.tsx` — não em `app/providers.tsx`, porque precisa de `useNavigate`/`useLocation`, que só existem dentro do `RouterProvider`. `RequireRole` protege uma rota (ou subárvore) pela hierarquia de perfil: sem sessão vai para `/login?returnTo=<rota>`; com perfil insuficiente renderiza uma página de "sem acesso" no lugar, sem deslogar e sem trocar a URL. Ouve `tedi:unauthorized` e, se já havia sessão autenticada, limpa o cache e redireciona para `/login?returnTo=...&reason=expired`; o 401 inicial de `/auth/me` é tratado como anônimo, não como expiração.

`shared/lib/role.ts` reexporta o enum `Role` gerado pelo Orval e expõe `roleSatisfies(userRole, minRole)`, espelhando a hierarquia do `RolesGuard` do back: `member < director < coordinator < superadmin`.

## 4. Regras de fronteira (`.dependency-cruiser.cjs`, roda no CI)

| Regra                                                      | Efeito                        |
| ---------------------------------------------------------- | ----------------------------- |
| `modules/X` só importa `@modules/Y` pela raiz (`index.ts`) | Isolamento entre módulos      |
| `shared/` não importa `modules/`                           | `shared/` continua genérico   |
| `api/` não importa `modules/`, `app/` nem `shared/`        | Camada de rede pura           |
| Só `api/` importa `http-client.ts`                         | Módulos usam os hooks gerados |
| Sem dependência circular                                   | —                             |

`src/api/generated/` fica fora da análise e do lint (é gerado).

## 5. Integração com a API (Orval)

```
tedi-back                                       tedi-front
1. muda DTO/controller
2. yarn openapi:export → docs/openapi.json
3. CI: openapi:check
4. merge em develop
5. workflow openapi.yml abre PR aqui  ───────▶  openapi/openapi.json
   com o contrato novo e `yarn generate`         src/api/generated/** regenerado
                                               6. CI: typecheck quebra se alguma tela usa campo que sumiu
```

Manualmente: copiar `docs/openapi.json` da API para `openapi/openapi.json` e rodar `yarn generate`.

Configuração em `orval.config.ts`: `mode: "tags-split"` (um arquivo por tag = um por módulo do back), `client: "react-query"`, `httpClient: "fetch"` com mutator `src/api/http-client.ts`, e um segundo output `client: "zod"`.

## 6. Testes

Vitest + Testing Library, `__tests__/` dentro do módulo (ou de `shared/<x>/`), arquivos `*.test.ts(x)`.

- Componentes e páginas: renderizar com `QueryClientProvider` e `MemoryRouter`; asserções por papel/texto acessível.
- Rede: mock com MSW. O Orval pode gerar handlers MSW a partir do mesmo contrato (`mock: true`), a habilitar quando o primeiro módulo existir.
- `yarn test` no CI. `yarn test:cov` para cobertura.

## 7. Bibliotecas

| Pacote                                        | Papel                                              |
| --------------------------------------------- | -------------------------------------------------- |
| `react-router-dom`                            | rotas, compostas por módulo                        |
| `@tanstack/react-query`                       | estado de servidor; os hooks gerados dependem dele |
| `react-hook-form` + `@hookform/resolvers`     | formulários com Zod                                |
| `zod`                                         | validação; schemas gerados pelo Orval              |
| `react-i18next`                               | textos de interface, um namespace por módulo       |
| `tailwindcss`                                 | estilos                                            |
| `@heroui/react` + `react-aria-components`     | componentes acessíveis; base do `shared/ui`        |
| `orval` (dev)                                 | geração da camada de integração                    |
| `vitest`, `@testing-library/*`, `jsdom` (dev) | testes                                             |
| `dependency-cruiser` (dev)                    | fronteiras entre módulos                           |

## 8. Próximos passos previstos

1. ~~Primeiro `openapi.json` da API → `yarn generate` → versionar `src/api/generated/`.~~ Feito em GUS-83.
2. `shared/ui`: base de componentes acessíveis (fonte base 16px, alvos 44px, contraste 4.5:1) sobre **HeroUI / React Aria**, já instalados. Componentes de `shared/ui` envolvem os do HeroUI com os padrões do TEDI; módulos não importam `@heroui/react` direto. Por enquanto existem `Button` (GUS-83; ganhou `isLoading` na GUS-84), `TextField` (aceita `type="email"` na GUS-85; ganhou `isReadOnly` na GUS-87), `PasswordField`, `Alert` (GUS-84; ganhou a variante estática `warning` e `description` na GUS-87 — sem `role` nem região viva, para avisos que já nascem preenchidos) e `Skeleton` (GUS-84), `Stepper` e `StatusCard` (GUS-85), e `Select`, `Tabs`, `Dialog` e `Badge` (GUS-87 — camadas finas sobre `Select`, `Tabs`, `Modal`/`ListBox` do HeroUI; `Tabs` só monta o painel selecionado). Os tokens do TEDI (`bg-tedi-sky`, as cores da tela de convite `tedi-success`, `tedi-warning`, `tedi-badge`, `tedi-summary`, e as de selo `tedi-neutral`/`tedi-danger` da GUS-87, e ajustes de contraste do tema do HeroUI: `--accent`, `--accent-hover`, `--danger`, `--field-border`, `--field-border-width`, `--disabled-opacity`) ficam em `src/index.css` e valem para o app inteiro. `Toast` continua sem existir: a GUS-87 decidiu não criá-lo (o aviso de link copiado usa `Alert info`, que já é uma região `role="status"`); fica para quem precisar.
3. Módulo `auth`: **parcialmente entregue em GUS-83, GUS-84, GUS-85 e GUS-87** (sessão via `/auth/me`, `RequireRole`, 401 com retorno, página de sem acesso, logout: GUS-83; formulário de login com RA e senha: GUS-84; aceite de convite: GUS-85; tela de Acessos: GUS-87). O aceite é a `InvitePage`, que atende `/invite?token=...` (cadastro em dois passos) e `/reset-password?token=...` (só a nova senha, o link que o back gera para a redefinição): ela decide pelo `type` que `GET /auth/invites/:token` devolve. O `PublicScreen` (fundo azul, cartão e rodapé) é o invólucro comum da tela de login e da de convite. A tela de Acessos (`/access`, `AccessPage`, sob `RequireRole minRole={Role.coordinator}`) tem duas abas — `AccessTable` (`GET /access`, paginado, busca por nome/RA) e `InvitesTable` (`GET /invites`, sem paginação) — e o `CreateInviteDialog`/`CreateInviteForm` (`POST /invites`), que mostra o link gerado uma única vez (nunca persistido: o estado morre ao fechar o diálogo). Faltam: menu por perfil no `AppLayout` e remover `app/pages/InicioPage.tsx` (GUS-86); ações por linha na tela de Acessos — mudar perfil, ativar/desativar, redefinir senha, revogar convite (GUS-88).
4. Módulo `pessoas` como referência para os demais.
5. Habilitar `mock: true` no Orval e MSW nos testes.
6. Resolver `VITE_API_URL` em build time: build por ambiente no pipeline ou config em runtime pelo nginx.
