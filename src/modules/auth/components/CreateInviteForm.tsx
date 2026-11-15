import { useId, useRef, type FormEvent, type ReactElement } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { getListInvitesQueryKey, useCreateInvite } from "@api/generated";
import type { CreateInviteDto } from "@api/generated/model";
import { CreateInviteBody } from "@api/generated/zod/auth/auth";
import { Role } from "@shared/lib/role";
import { Alert, Button, Select } from "@shared/ui";

import { INVITE_VALIDITY_HOURS } from "../lib/invite-validity";
import { toRequestErrorKey } from "../lib/request-error";
import { INVITABLE_ROLES } from "../lib/role-label";
import { GeneratedLink } from "./GeneratedLink";

export interface CreateInviteFormProps {
  onDone: () => void;
  /** Avisa o diálogo durante o POST para bloquear Esc e X: fechar não cancela a mutação e o link gerado se perderia. */
  onPendingChange?: (isPending: boolean) => void;
}

export function CreateInviteForm({ onDone, onPendingChange }: CreateInviteFormProps): ReactElement {
  const { t } = useTranslation(["auth", "common"]);
  const queryClient = useQueryClient();
  const errorId = useId();

  const { control, handleSubmit } = useForm<CreateInviteDto>({
    resolver: zodResolver(CreateInviteBody),
    defaultValues: { role: Role.member },
  });

  const createInvite = useCreateInvite({
    mutation: {
      // O token só existe na resposta desta mutação: não deve sobreviver ao desmonte do formulário.
      gcTime: 0,
      // Atualiza a contagem de "Convites pendentes" da listagem de acessos.
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListInvitesQueryKey() });
      },
    },
  });

  const errorKey = createInvite.isError ? toRequestErrorKey(createInvite.error) : null;
  const roleOptions = INVITABLE_ROLES.map((role) => ({
    id: role,
    label: t(`roles.${role}`, { ns: "common" }),
  }));

  // Trava síncrona contra envio duplo, no mesmo padrão do LoginForm: handleSubmit valida de
  // forma assíncrona, e `isPending` só chega ao componente no próximo render.
  const inFlightRef = useRef(false);

  function submitRole(values: CreateInviteDto) {
    if (createInvite.isPending || inFlightRef.current) return;
    inFlightRef.current = true;
    onPendingChange?.(true);
    createInvite.mutate(
      { data: values },
      {
        onSettled: () => {
          inFlightRef.current = false;
          onPendingChange?.(false);
        },
      },
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    void handleSubmit(submitRole)(event);
  }

  if (createInvite.isSuccess) {
    const { url, role } = createInvite.data;

    return (
      <GeneratedLink
        url={url}
        linkLabel={t("access.createInvite.link.label")}
        validityTitle={t("access.createInvite.validityTitle")}
        validityDescription={t("access.createInvite.validity", { hours: INVITE_VALIDITY_HOURS })}
        onDone={onDone}
      >
        <Select
          label={t("access.createInvite.role.label")}
          options={roleOptions}
          value={role ?? Role.member}
          onChange={() => {}}
          isDisabled
        />
      </GeneratedLink>
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
