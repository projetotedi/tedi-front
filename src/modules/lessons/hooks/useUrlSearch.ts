import { useCallback, useEffect, useRef, useState } from "react";

import { useDebounce } from "@shared/hooks/useDebounce";

export interface UrlSearch {
  /** What is in the search box, as typed. */
  text: string;
  setText: (text: string) => void;
  /** Empties the box at once, for Limpar filtros: the screen clears the URL by itself. */
  clear: () => void;
}

/**
 * The search box of a list whose search lives in the URL. What is typed goes to the URL once the
 * typing stops (`commit`, after `delayMs`), and the URL is the truth: when it changes by any other
 * way (Voltar, a click on the menu item of the screen, Limpar filtros) the box follows it. Without
 * that, the text that was still in the box would be written back to the URL.
 *
 * A box that is ahead of its own pause (still being typed in) never writes. The text is compared
 * without the spaces around it, as the API reads it.
 */
export function useUrlSearch(
  urlSearch: string,
  commit: (search: string) => void,
  delayMs: number,
): UrlSearch {
  const [text, setText] = useState(urlSearch);
  const debounced = useDebounce(text.trim(), delayMs);
  // What the URL said, as far as the box knows. A URL that differs from it came from somewhere else.
  const seenUrlRef = useRef(urlSearch);

  useEffect(() => {
    if (urlSearch === seenUrlRef.current) return;
    seenUrlRef.current = urlSearch;
    setText(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    if (debounced !== text.trim()) return;
    if (debounced === urlSearch.trim()) return;
    seenUrlRef.current = debounced;
    commit(debounced);
  }, [debounced, text, urlSearch, commit]);

  const clear = useCallback(() => {
    seenUrlRef.current = "";
    setText("");
  }, []);

  return { text, setText, clear };
}
