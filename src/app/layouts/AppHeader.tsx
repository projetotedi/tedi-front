import { UserMenu } from "@modules/auth";

import { useHeaderTitle } from "./useHeaderTitle";

/** Cabeçalho da área autenticada: título da página (`h1`) à esquerda e menu de perfil à direita. */
export function AppHeader() {
  const title = useHeaderTitle();

  return (
    <header className="flex items-center justify-between gap-4 border-b border-tedi-header-border bg-white px-4 py-5 lg:px-6 3xl:px-25">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      <UserMenu />
    </header>
  );
}
