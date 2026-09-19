# Figma — como a skill lê o design de uma tela

Vale só para card do `tedi-front` que traga uma tela. Quem chama o Figma é a skill (o orquestrador), uma vez por frame. `tedi-planner` e `tedi-reviewer` não têm ferramentas de MCP: recebem o resumo pronto. Isso também poupa chamadas, porque conta sem assento Dev/Full tem só 6 chamadas por mês.

## Entrada

O link do frame vem do pedido do usuário, junto com a issue (por exemplo, `/do-task GUS-74 <link do frame>`). O card do Linear não guarda o design, então a skill não procura nele. Se o card for `Frontend`, envolver uma tela e o pedido não trouxer o link, pergunte o link do frame ou um PNG (ver "Sem MCP"). O link precisa ter `node-id`.

Do link, extraia:

- `fileKey`: o trecho depois de `/design/`. Em link de branch (`/design/<fileKey>/branch/<branchKey>/...`), use o `branchKey`.
- `nodeId`: o valor de `node-id`, trocando `-` por `:` (`1-271` vira `1:271`).
- Sem `node-id`: peça o link do frame (botão direito no frame, "Copy link to selection").

## Passos

1. Confirme que `get_design_context` está na lista de ferramentas do Figma. Se não estiver, ofereça ativar o conector; se o usuário não quiser, siga em "Sem MCP".
2. Carregue o guia do Figma antes da chamada (a própria ferramenta exige): a skill `figma-design-to-code` do plugin oficial, ou o recurso `skill://figma/figma-design-to-code/SKILL.md` pela ferramenta `get_figma_skill`.
3. Chame `get_design_context` com `fileKey`, `nodeId`, `clientFrameworks: react`, `clientLanguages: typescript` e `skillNames: figma-design-to-code` (com prefixo `resource:` se o guia veio pelo recurso). A resposta já traz código de referência, captura de tela, tokens com nome e a documentação dos componentes. Uma chamada por frame; `get_variable_defs` só se faltar token.
4. Se a resposta vier como "sparse" (só metadados), peça os frames filhos relevantes, cada um em sua própria chamada de `get_design_context`.
5. Baixe os assets (logo, ícones) como a resposta indica, para `src/assets/`. Os links do Figma expiram em 7 dias, então nenhum link do Figma fica no código.
6. Grave o resumo em `.agents/artifacts/design-GUS-<n>.md` (formato abaixo) e o código de referência em `.agents/artifacts/design-GUS-<n>.tsx`. Os dois ficam fora do git.
7. Conflitos com o `AGENTS.md` e estados que faltam entram na aprovação do plano (etapa 3.1).

## Formato do resumo

- Frame: nome, link, `nodeId`.
- Layout: em palavras, de cima para baixo, com larguras e espaçamentos.
- Componentes: cada peça do Figma, o componente de `@shared/ui` que a atende e se já existe ou precisa ser criado.
- Tokens usados: nome, valor e onde entra em `src/index.css`.
- Textos: todos, em pt-BR (viram chaves de i18n em inglês).
- Estados mostrados e estados que faltam (foco, erro, carregando, desabilitado, vazio).
- Conflitos com o `AGENTS.md`.
- Assets: arquivo em `src/assets/`.

## Como usar o código de referência

O código que a ferramenta devolve é um protótipo visual, não é para colar. O dev adapta:

- Reaproveita `@shared/ui` e `@shared/components` antes de criar algo. Componente que falta em `shared/ui` é criado envolvendo o HeroUI; a tela nunca importa `@heroui/react`.
- Não copia Tailwind com valor solto (`w-[440px]`, `bg-[#8ec6e6]`). Usa os tokens (variáveis CSS do `src/index.css`); valor solto só quando não existe token.
- Monta o layout com flex/grid, não com o posicionamento absoluto do protótipo.
- Textos por `react-i18next`, nunca fixos no componente.
- Formulário com `react-hook-form` + `zodResolver` e schema gerado, como manda o `AGENTS.md`.
- Não instala dependência nova por causa do design.

## Conflito entre o design e o AGENTS.md

Fonte base, tamanho de alvo de toque, contraste e foco seguem o `AGENTS.md` (público idoso). Se o Figma pedir menos (campo de 36px, texto de 14px), o dev implementa o valor do `AGENTS.md`, registra em "Divergências do design" no relatório e no PR (seção Observações), e a skill avisa o usuário para alinhar com o designer. Ninguém altera o Figma.

## Estados que faltam

Foco visível, erro, carregando e desabilitado são implementados com os padrões do `shared/ui` mesmo que não estejam desenhados, e o relatório lista como "estados não desenhados".

## Sem MCP

Sem conector, sem permissão no arquivo ("no edit access", "locked team") ou sem chamadas no mês: não insista. Peça o PNG do frame e faça o resumo pela imagem, escrevendo "medidas estimadas pela imagem" no resumo. Não invente valores exatos.

## Exemplo: Tela — Login (frame 1:271)

- Layout: fundo `#8ec6e6`; card branco de 440px, raio 24, padding 32, gap 20, sombra leve; logo de 146x121 centralizado; texto de rodapé de 12px abaixo do card (gap 24).
- Componentes: TextField (Label + Input) duas vezes, Checkbox ("Manter conectado"), Button ("Entrar", largura total, formato de pílula) e o link "Esqueceu a senha?" (`#0466d9`). Todos têm documentação do HeroUI v3 no Figma.
- Tokens: `accent/accent` (`#0485f7`), `accent/accent-foreground` (`#fcfcfc`), `foreground/foreground` (`#18181b`), `foreground/muted` (`#71717a`), `field/radius` (12px), `field/border-width` (1px), `dimensions/spacing/1` a `/4`, `dimensions/font/text-sm` (14px) e `text-xs` (12px). Fonte Inter.
- Estados: só o padrão. Faltam foco, erro de credencial, botão carregando e mostrar/ocultar senha.
- Conflitos com o `AGENTS.md`: campos e botão de 36px (mínimo 44px); texto de 14px e 12px (base 16px); texto branco sobre o azul do botão em cerca de 3,6:1 (mínimo 4,5:1, medir); borda de campo transparente, então o limite do campo quase não aparece.
- Assets: logo em `src/assets/`. A imagem parece ter um cursor e uma caixa tracejada sobre o "E"; confirmar com o designer.
- Destino no código: módulo `auth`, `LoginPage` dentro do `PublicLayout`.
