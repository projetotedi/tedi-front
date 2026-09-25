import { useTranslation } from "react-i18next";
import { useMatches } from "react-router-dom";

import { getHeaderTitle } from "@shared/lib/route-handle";

/**
 * Título do cabeçalho: o `handle.headerTitle` da rota mais interna que o declara, já traduzido.
 * Rotas sem título (ex.: a página inicial) mostram o nome da aplicação.
 */
export function useHeaderTitle(): string {
  const { t } = useTranslation();
  const matches = useMatches();

  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const title = getHeaderTitle(matches[index]?.handle);
    if (title) return t(title.key, { ns: title.ns });
  }

  return t("app.name");
}
