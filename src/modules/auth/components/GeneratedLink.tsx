import { useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Alert, Button, TextField } from "@shared/ui";

export interface GeneratedLinkProps {
  /** O link, mostrado em um campo só leitura. Vive só na memória de quem o gerou. */
  url: string;
  linkLabel: string;
  /** Título do aviso de validade, que descreve o botão Copiar link para leitores de tela. */
  validityTitle: string;
  validityDescription: string;
  /** "Concluir": quem usa fecha o diálogo e o link se perde junto com o componente. */
  onDone: () => void;
  /**
   * `stacked` (convite): campo, botão Copiar link embaixo. `inline` (redefinição de senha): botão
   * ao lado do campo, alinhado à base, a partir do breakpoint `sm`.
   */
  layout?: "stacked" | "inline";
  /** Contexto acima do link: o perfil do convite, o resumo do membro. */
  children?: ReactNode;
}

type CopyStatus = "idle" | "copied" | "fallback";

/**
 * O passo "link gerado" de um convite ou de uma redefinição de senha: link só leitura, Copiar link
 * (com confirmação ou, sem Clipboard API, o link já selecionado), aviso de validade e Concluir.
 */
export function GeneratedLink({
  url,
  linkLabel,
  validityTitle,
  validityDescription,
  onDone,
  layout = "stacked",
  children,
}: GeneratedLinkProps): ReactElement {
  const { t } = useTranslation("auth");
  const validityId = useId();
  const linkRef = useRef<HTMLInputElement>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");

  async function copyLink() {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(url);
      setCopyStatus("copied");
    } catch {
      linkRef.current?.focus();
      linkRef.current?.select();
      setCopyStatus("fallback");
    }
  }

  const field = (
    <TextField label={linkLabel} value={url} onChange={() => {}} isReadOnly inputRef={linkRef} />
  );
  const copyButton = (
    <Button
      autoFocus
      aria-describedby={validityId}
      className={layout === "inline" ? "sm:shrink-0" : ""}
      onPress={() => void copyLink()}
    >
      {t("access.generatedLink.copy")}
    </Button>
  );

  return (
    <div className="flex flex-col gap-5">
      {children}
      {layout === "inline" ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">{field}</div>
          {copyButton}
        </div>
      ) : (
        <>
          {field}
          {copyButton}
        </>
      )}
      <Alert variant="info">
        {copyStatus === "copied"
          ? t("access.generatedLink.copied")
          : copyStatus === "fallback"
            ? t("access.generatedLink.copyFallback")
            : null}
      </Alert>
      <Alert variant="warning" id={validityId} description={validityDescription}>
        {validityTitle}
      </Alert>
      <div className="flex justify-end">
        <Button onPress={onDone}>{t("access.generatedLink.done")}</Button>
      </div>
    </div>
  );
}
