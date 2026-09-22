import { useId, useRef, useState, type FormEvent, type ReactElement } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { getListInvitesQueryKey, useCreateInvite } from "@api/generated";
import type { CreateInviteDto } from "@api/generated/model";
import { CreateInviteBody } from "@api/generated/zod/auth/auth";
import { Role } from "@shared/lib/role";
import { Alert, Button, Select, TextField } from "@shared/ui";

import { INVITE_VALIDITY_HOURS } from "../lib/invite-validity";
import { toRequestErrorKey } from "../lib/request-error";
import { INVITABLE_ROLES, roleLabelKey } from "../lib/role-label";

export interface CreateInviteFormProps {
  onCreated?: () => void;
  onDone: () => void;
}

type CopyStatus = "idle" | "copied" | "fallback";

/**
 * Conteúdo do `CreateInviteDialog`. Antes de gerar: seletor de perfil. Depois: o link (uma
 * única vez — o estado morre com o componente ao fechar o diálogo, e nunca é persistido).
 */
export function CreateInviteForm({ onCreated, onDone }: CreateInviteFormProps): ReactElement {
  const { t } = useTranslation("auth");
  const queryClient = useQueryClient();
  const errorId = useId();
  const linkRef = useRef<HTMLInputElement>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");

  const { control, handleSubmit } = useForm<CreateInviteDto>({
    resolver: zodResolver(CreateInviteBody),
    defaultValues: { role: Role.member },
  });

  const createInvite = useCreateInvite({
    mutation: {
      // O token só existe na resposta desta mutação: não deve sobreviver ao desmonte do formulário.
      gcTime: 0,
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListInvitesQueryKey() });
        onCreated?.();
      },
    },
  });

  const errorKey = createInvite.isError ? toRequestErrorKey(createInvite.error) : null;
  const roleOptions = INVITABLE_ROLES.map((role) => ({
    id: role,
    label: t(roleLabelKey(role) ?? ""),
  }));

  // Trava síncrona contra envio duplo, no mesmo padrão do LoginForm: handleSubmit valida de
  // forma assíncrona, e `isPending` só chega ao componente no próximo render.
  const inFlightRef = useRef(false);

  function submitRole(values: CreateInviteDto) {
    if (createInvite.isPending || inFlightRef.current) return;
    inFlightRef.current = true;
    createInvite.mutate(
      { data: values },
      {
        onSettled: () => {
          inFlightRef.current = false;
        },
      },
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit(submitRole)(event);
  }

  async function copyLink(url: string) {
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

  if (createInvite.isSuccess) {
    const { url, role } = createInvite.data;

    return (
      <div className="flex flex-col gap-5">
        <Select
          label={t("access.createInvite.role.label")}
          options={roleOptions}
          value={role ?? Role.member}
          onChange={() => {}}
          isDisabled
        />
        <TextField
          label={t("access.createInvite.link.label")}
          value={url}
          onChange={() => {}}
          isReadOnly
          inputRef={linkRef}
        />
        <Button autoFocus onPress={() => void copyLink(url)}>
          {t("access.createInvite.copy")}
        </Button>
        <Alert variant="info">
          {copyStatus === "copied"
            ? t("access.createInvite.copied")
            : copyStatus === "fallback"
              ? t("access.createInvite.copyFallback")
              : null}
        </Alert>
        <Alert variant="warning">
          {t("access.createInvite.validity", { hours: INVITE_VALIDITY_HOURS })}
        </Alert>
        <div className="flex justify-end">
          <Button onPress={onDone}>{t("access.createInvite.done")}</Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-busy={createInvite.isPending}
      className="flex flex-col gap-5"
    >
      <Controller
        name="role"
        control={control}
        render={({ field }) => (
          <Select
            label={t("access.createInvite.role.label")}
            options={roleOptions}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            autoFocus
            isDisabled={createInvite.isPending}
          />
        )}
      />

      <Alert variant="error" id={errorId}>
        {errorKey ? t(`access.createInvite.errors.${errorKey}`) : null}
      </Alert>

      <div className="flex justify-end">
        <Button type="submit" isLoading={createInvite.isPending}>
          {createInvite.isPending
            ? t("access.createInvite.submitting")
            : t("access.createInvite.submit")}
        </Button>
      </div>
    </form>
  );
}
