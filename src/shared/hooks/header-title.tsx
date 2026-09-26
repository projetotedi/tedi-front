import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface HeaderTitleContextValue {
  title: string | null;
  setTitle: (title: string | null) => void;
}

const HeaderTitleContext = createContext<HeaderTitleContextValue | null>(null);

/** Guarda o título que uma tela pede para o cabeçalho, acima do que a rota declara. */
export function HeaderTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  return <HeaderTitleContext value={{ title, setTitle }}>{children}</HeaderTitleContext>;
}

/** Título pedido por uma tela (ou `null`). Fora do provider, sempre `null`. */
export function useHeaderTitleOverride(): string | null {
  return useContext(HeaderTitleContext)?.title ?? null;
}

/**
 * Telas renderizadas no lugar da rota (ex.: acesso negado) usam isto para trocar o título do
 * cabeçalho enquanto estiverem montadas. Fora do provider não faz nada.
 */
export function useSetHeaderTitle(title: string): void {
  const context = useContext(HeaderTitleContext);
  const setTitle = context?.setTitle;

  useEffect(() => {
    setTitle?.(title);
    return () => setTitle?.(null);
  }, [setTitle, title]);
}
