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
│   ├── menu.ts                       # concatena os <modulo>MenuItems (ordem do menu lateral)
│   ├── useAppMenu.ts                 # menu filtrado pelo perfil do usuário logado
│   ├── prototype-routes.tsx          # áreas do protótipo ainda sem módulo → "Em breve"
│   ├── layouts/
│   │   ├── AppLayout.tsx             # área autenticada: sidebar, topbar com título e menu do perfil
│   │   ├── ProfileMenu.tsx           # avatar + perfil → Perfil / Sair
│   │   ├── SidebarBrand.tsx
│   │   └── PublicLayout.tsx          # login e formulário público (acessibilidade reforçada)
│   └── pages/ComingSoonPage.tsx
│
├── assets/                           # SVGs baixados do Figma (ícones, marca, textura da sidebar)
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
│   ├── auth/  people/  pessoas/  importacao/  turmas/  aulas/  alocacoes/
│   ├── presencas/  horas/  relatorios/  auditoria/
│   └── <modulo>/                     # ver template abaixo
│
└── shared/                           # genérico, sem domínio
    ├── ui/                           # Button, TextField, PasswordField, Alert, Skeleton, Stepper, StatusCard, Select, Dialog, Toast (acessíveis)
    ├── components/                   # PageTitle, DataTable, EmptyState, ConfirmDialog
    ├── hooks/                        # useDocumentTitle, useDebounce...
    ├── i18n/                         # init do i18next + registerModuleLocales + locales/common
    └── lib/                          # role, menu (MenuItem), route-handle (título da rota), datas
```

Fora de `src/`: `openapi/openapi.json` (cópia versionada do contrato da API), `orval.config.ts`, `vitest.setup.ts`, `.dependency-cruiser.cjs`.

Aliases: `@app/*`, `@api/*`, `@modules/*`, `@shared/*`.

### 2.1 Template de um módulo

```
modules/pessoas/
├── index.ts                  # API pública: routes + o que outros módulos podem usar
├── routes.tsx                # RouteObject[] do módulo, com RequireRole e handle: { title }
├── menu.ts                   # <modulo>MenuItems: itens do menu lateral (label i18n, path, minRole, icon)
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

**Menu e título.** O menu lateral do `AppLayout` sai de `app/menu.ts`, que concatena os `<modulo>MenuItems` exportados por cada módulo (GUS-86):

```ts
// shared/lib/menu.ts
interface MenuItem {
  label: string; // chave i18n com namespace, ex.: "auth:access.title"
  path: string; // rota declarada no routes.tsx do módulo
  minRole: Role; // repete o RequireRole da rota (decisão 18: menu e guarda andam juntos)
  icon: string; // URL de SVG de 24px (import de arquivo .svg)
}
function filterMenuByRole(items: readonly MenuItem[], role: Role | null | undefined): MenuItem[];
```

`useAppMenu()` aplica o filtro com o perfil da sessão. Um módulo novo exporta `<modulo>MenuItems` e rotas com `handle: { title: "<ns>:<chave>" }`, e ganha uma linha em `app/menu.ts` e outra em `app/router.tsx`; se o item já existia em `prototypeMenuItems` (área do protótipo com página "Em breve"), a linha do protótipo sai. O `AppLayout` usa o `handle.title` da rota mais interna como `<h1>` da topbar e título da aba; por isso as páginas autenticadas não repetem o título.

Após o login, `/` redireciona para `/profile` ("Meu perfil", módulo `people`). Abaixo de 1024px a sidebar vira um `Drawer`, aberto pelo botão de menu da topbar.

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
const authProtectedRoutes: RouteObject[]; // rotas autenticadas (hoje: "access", só coordinator)
const authMenuItems: MenuItem[]; // "Acessos", só coordinator
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
2. `shared/ui`: base de componentes acessíveis (fonte base 16px, alvos 44px, contraste 4.5:1) sobre **HeroUI / React Aria**, já instalados. Componentes de `shared/ui` envolvem os do HeroUI com os padrões do TEDI; módulos não importam `@heroui/react` direto. Por enquanto existem `Button` (GUS-83; ganhou `isLoading` na GUS-84), `TextField` (aceita `type="email"` na GUS-85), `PasswordField`, `Alert` e `Skeleton` (GUS-84), e `Stepper` e `StatusCard` (GUS-85). Os tokens do TEDI (`bg-tedi-sky`, as cores da tela de convite `tedi-success`, `tedi-warning`, `tedi-badge` e `tedi-summary`, e ajustes de contraste do tema do HeroUI: `--accent`, `--accent-hover`, `--danger`, `--field-border`, `--field-border-width`, `--disabled-opacity`) ficam em `src/index.css` e valem para o app inteiro.
   GUS-86 acrescentou `NavList`, `Avatar`, `Card`, `Chip`, `Dropdown` e `Drawer`, e os tokens da sidebar `tedi-sky-border` e `tedi-brand-muted`; `SignOutButton` passou a aceitar `label`.
3. Módulo `auth`: **parcialmente entregue em GUS-83, GUS-84 e GUS-85** (sessão via `/auth/me`, `RequireRole`, 401 com retorno, página de sem acesso, logout: GUS-83; formulário de login com RA e senha: GUS-84; aceite de convite: GUS-85). O aceite é a `InvitePage`, que atende `/invite?token=...` (cadastro em dois passos) e `/reset-password?token=...` (só a nova senha, o link que o back gera para a redefinição): ela decide pelo `type` que `GET /auth/invites/:token` devolve. O `PublicScreen` (fundo azul, cartão e rodapé) é o invólucro comum da tela de login e da de convite. Faltam: menu por perfil no `AppLayout` e remover `app/pages/InicioPage.tsx` (GUS-86), telas de Acessos (GUS-87/88).
   Menu por perfil, topbar e "Meu perfil" como tela inicial: GUS-86 (`InicioPage` removida). `/access` é um placeholder até GUS-87/88, que só trocam a `AccessPage`. "Meu perfil" (`modules/people`) usa dados de exemplo além de nome, perfil e RA da sessão, até o back expor horas e cadastro.
4. Módulo `pessoas` como referência para os demais.
5. Habilitar `mock: true` no Orval e MSW nos testes.
6. Resolver `VITE_API_URL` em build time: build por ambiente no pipeline ou config em runtime pelo nginx.
