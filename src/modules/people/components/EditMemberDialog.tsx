import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState, type ReactElement } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useUpdateAccessRole } from "@api/generated";
import type { AccessResponseDto, MemberDetailResponseDto } from "@api/generated/model";
import {
  getGetMemberQueryKey,
  getListDepartmentsQueryKey,
  useGetMember,
  useListDepartments,
  useUpdateMember,
} from "@api/generated/people/people";
import {
  ActionError,
  MemberAccessCard,
  toAccessActionErrorKey,
  toAssignableRole,
  useAuth,
  useCan,
  type AssignableRole,
  type MemberAccessTarget,
} from "@modules/auth";
import { scopeOf } from "@shared/lib/permissions";
import { Alert, Button, Dialog, Skeleton, toast } from "@shared/ui";

import { isActiveApprovedMember, isMemberForbidden, isMemberNotFound } from "../lib/member";
import { toUpdateMemberError } from "../lib/member-errors";
import { invalidateAfterMemberChanged } from "../lib/member-queries";
import {
  MEMBER_FORM_FIELDS,
  MEMBER_LIMITS,
  memberFormSchema,
  toMemberFormValues,
  toUpdateMemberBody,
  type MemberFormFieldName,
  type MemberFormValues,
} from "../schemas/member.schema";
import { MemberDataFields } from "./MemberDataFields";

export interface EditMemberDialogProps {
  /** The id of the person: the row of the list of members or the member of the record. */
  memberId: string;
  onClose: () => void;
}

/** What takes the focus inside a field: a text box, a segment of a date or the button of a list. */
const FOCUSABLE = "input:not(:disabled), button:not(:disabled), [role='spinbutton']";

function LoadingColumn({ label }: { label: string }): ReactElement {
  return (
    <div role="status" className="flex flex-col gap-4 pt-2">
      <p className="sr-only">{label}</p>
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}

/**
 * The person whose data cannot be edited here (the seeded coordinator, a registration not approved
 * yet, an inactive member): the name, the RA and the e-mail, and why the data is read only. The
 * access card next to it still works.
 */
function ReadOnlySummary({ member }: { member: MemberDetailResponseDto }): ReactElement {
  const { t } = useTranslation("people");
  const rows = [
    { label: t("member.edit.summary.name"), value: member.name },
    { label: t("member.edit.summary.ra"), value: member.ra },
    { label: t("member.edit.summary.email"), value: member.email },
  ];

  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col gap-3">
        {rows.map(({ label, value }) =>
          value ? (
            <div key={label}>
              <dt className="text-base text-muted">{label}</dt>
              <dd className="text-base break-all text-foreground">{value}</dd>
            </div>
          ) : null,
        )}
      </dl>
      <p className="text-base text-muted">{t("member.edit.readOnly")}</p>
    </div>
  );
}

interface EditMemberContentProps {
  member: MemberDetailResponseDto;
  formId: string;
  onSavingChange: (isSaving: boolean) => void;
  onClose: () => void;
}

/**
 * The two columns of the dialog, once the member is loaded. The data of the member is a form only
 * for an approved registration of someone still in the project and for who may edit it
 * (`members.edit`); the card "Acesso ao sistema" shows with `access.manage`. Salvar alterações
 * sends only what changed: `PATCH /members/:id` with the changed fields and, after it, `PATCH
 * /access/:id/role` when the profile changed. With nothing changed it only closes.
 */
function EditMemberContent({
  member,
  formId,
  onSavingChange,
  onClose,
}: EditMemberContentProps): ReactElement {
  const { t } = useTranslation(["people", "auth", "common"]);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const dataTitleId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const inFlightRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManageAccess = useCan("access.manage");
  // The record only loads inside the scope of `members.view`, the same department scope a director
  // has for `members.edit`: the API answers 403 FORBIDDEN_SCOPE to anything else.
  const isEditable = useCan("members.edit") && isActiveApprovedMember(member);
  // Moving a member to another department is for who edits any member: a director only keeps the
  // department (403 DEPARTMENT_SCOPE), so the list of departments is not even asked.
  const canChangeDepartment = scopeOf(user, "members.edit") === "all";
  const departmentsQuery = useListDepartments({
    query: { enabled: isEditable && canChangeDepartment },
  });

  // The access card changes the access on the spot (desativar, reativar), and the answer is newer
  // than the record until it is fetched again.
  const [accessUpdate, setAccessUpdate] = useState<AccessResponseDto | null>(null);
  const access: MemberAccessTarget = accessUpdate ?? {
    id: member.id,
    name: member.name,
    ra: member.ra,
    role: member.role,
    accessEnabled: member.accessEnabled,
  };
  const [roleChoice, setRoleChoice] = useState<AssignableRole | null>(null);
  const selectedRole = roleChoice ?? toAssignableRole(access.role);
  const roleToSave =
    canManageAccess && selectedRole !== null && selectedRole !== access.role ? selectedRole : null;

  const initialValues = useMemo(() => toMemberFormValues(member), [member]);
  const { control, handleSubmit, setError, reset } = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: initialValues,
    // The dates have no ref, so the focus on the first invalid field is set by hand.
    shouldFocusError: false,
  });

  const updateMember = useUpdateMember();
  const updateRole = useUpdateAccessRole();

  useEffect(() => onSavingChange(isSaving), [isSaving, onSavingChange]);

  function focusField(name: MemberFormFieldName) {
    formRef.current
      ?.querySelector(`[data-field="${name}"]`)
      ?.querySelector<HTMLElement>(FOCUSABLE)
      ?.focus();
  }

  function onInvalid(errors: FieldErrors<MemberFormValues>) {
    const first = MEMBER_FORM_FIELDS.find((name) => errors[name] !== undefined);
    if (first) focusField(first);
  }

  function showMemberError(error: unknown) {
    const result = toUpdateMemberError(error);
    if (result.kind !== "fields") {
      setActionError(t(`member.edit.actionErrors.${result.kind}`));
      return;
    }
    if (result.fields.some(({ message }) => message === "departmentNotFound")) {
      void queryClient.invalidateQueries({ queryKey: getListDepartmentsQueryKey() });
    }
    // A department that this person cannot change takes no focus: the message goes above the form.
    const fields = result.fields.filter(
      ({ name }) => canChangeDepartment || name !== "departmentId",
    );
    if (fields.length === 0) {
      setActionError(t(`member.edit.errors.${result.fields[0].message}`, MEMBER_LIMITS));
      return;
    }
    for (const { name, message } of fields) setError(name, { type: "server", message });
    focusField(fields[0].name);
  }

  function showRoleError(error: unknown) {
    const key = toAccessActionErrorKey(error);
    // The profile did not change in the API: the list goes back to the one the person has.
    if (key === "lastCoordinator") setRoleChoice(null);
    setActionError(t(`access.actionErrors.${key}`, { ns: "auth" }));
  }

  async function save(values: MemberFormValues | null) {
    if (inFlightRef.current) return;
    const body = values === null ? {} : toUpdateMemberBody(values, initialValues);
    const hasDataChange = Object.keys(body).length > 0;
    if (!hasDataChange && roleToSave === null) {
      onClose();
      return;
    }

    inFlightRef.current = true;
    setIsSaving(true);
    setActionError(null);
    let hasSaved = false;
    try {
      if (hasDataChange) {
        try {
          const updated = await updateMember.mutateAsync({ id: member.id, data: body });
          hasSaved = true;
          queryClient.setQueryData(getGetMemberQueryKey(member.id), updated);
          // A role that fails next keeps the dialog open: what was saved is the new start.
          reset(toMemberFormValues(updated));
          toast.success(t("member.edit.saved", { name: updated.name }));
        } catch (error) {
          showMemberError(error);
          return;
        }
      }
      if (roleToSave !== null) {
        try {
          await updateRole.mutateAsync({ id: member.id, data: { role: roleToSave } });
          hasSaved = true;
          toast.success(
            t("access.toast.roleUpdated", {
              ns: "auth",
              name: access.name,
              role: t(`roles.${roleToSave}`, { ns: "common" }),
            }),
          );
        } catch (error) {
          showRoleError(error);
          return;
        }
      }
      onClose();
    } finally {
      if (hasSaved) void invalidateAfterMemberChanged(queryClient, member.id);
      inFlightRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <ActionError message={actionError} />
      <div
        aria-busy={isSaving}
        className={`grid gap-6 ${canManageAccess ? "lg:grid-cols-[minmax(0,1fr)_288px]" : ""}`}
      >
        <form
          ref={formRef}
          id={formId}
          noValidate
          aria-labelledby={dataTitleId}
          onSubmit={(event) => {
            if (isEditable) {
              void handleSubmit(save, onInvalid)(event);
              return;
            }
            event.preventDefault();
            void save(null);
          }}
          className="flex min-w-0 flex-col gap-4"
        >
          <h3 id={dataTitleId} className="text-base font-semibold text-foreground">
            {t("member.edit.dataTitle")}
          </h3>
          {isEditable ? (
            <MemberDataFields
              control={control}
              cpfMasked={member.cpfMasked}
              currentDepartment={member.department}
              departments={departmentsQuery.data ?? []}
              canChangeDepartment={canChangeDepartment}
              isDepartmentsLoading={departmentsQuery.isLoading}
              isDepartmentsError={departmentsQuery.isError}
              onRetryDepartments={() => void departmentsQuery.refetch()}
            />
          ) : (
            <ReadOnlySummary member={member} />
          )}
        </form>

        {canManageAccess ? (
          <MemberAccessCard
            access={access}
            selectedRole={selectedRole}
            onRoleChange={setRoleChoice}
            onAccessChange={(updated) => {
              setAccessUpdate(updated);
              void queryClient.invalidateQueries({ queryKey: getGetMemberQueryKey(member.id) });
            }}
            isSaving={isSaving}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Editar membro (GUS-148, GUS-88, GUS-194; Figma "Membro · modal Editar membro" and "Membros ·
 * modal Editar membro"), opened by Editar membro on the record and by the pencil of the list. It
 * loads the member first, with `gcTime: 0` as on the record (it holds the phone, the address and
 * the masked CPF), and shows the data on the left and, for who manages access, the card "Acesso ao
 * sistema" on the right. A member it cannot load says why: out of the scope of the person, gone or
 * a failure, with Tentar de novo.
 *
 * It closes itself after the save; desativar, reativar and the reset link act on the spot, each
 * with its own confirmation, and keep it open.
 */
export function EditMemberDialog({ memberId, onClose }: EditMemberDialogProps): ReactElement {
  const { t } = useTranslation("people");
  const formId = useId();
  const [isSaving, setIsSaving] = useState(false);
  const memberQuery = useGetMember(memberId, { query: { gcTime: 0 } });
  const member = memberQuery.data;

  function renderLoadFailure(): ReactElement {
    if (isMemberForbidden(memberQuery.error)) {
      return <Alert variant="error">{t("member.edit.loadForbidden")}</Alert>;
    }
    if (isMemberNotFound(memberQuery.error)) {
      return <Alert variant="error">{t("member.edit.loadNotFound")}</Alert>;
    }
    return (
      <div className="flex flex-col items-start gap-3 pt-2">
        <Alert variant="error">{t("member.edit.loadError")}</Alert>
        <Button
          variant="secondary"
          isLoading={memberQuery.isFetching}
          onPress={() => void memberQuery.refetch()}
        >
          {t("member.edit.retry")}
        </Button>
      </div>
    );
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      size="extraWide"
      title={t("member.edit.title")}
      closeLabel={t("member.edit.close")}
      isDismissable={!isSaving}
      footer={
        <>
          <Button variant="secondary" isDisabled={isSaving} onPress={onClose}>
            {t("member.edit.cancel")}
          </Button>
          {member ? (
            <Button type="submit" form={formId} isLoading={isSaving}>
              {isSaving ? t("member.edit.saving") : t("member.edit.save")}
            </Button>
          ) : null}
        </>
      }
    >
      {member ? (
        <EditMemberContent
          member={member}
          formId={formId}
          onSavingChange={setIsSaving}
          onClose={onClose}
        />
      ) : memberQuery.isPending ? (
        <LoadingColumn label={t("member.edit.loading")} />
      ) : (
        renderLoadFailure()
      )}
    </Dialog>
  );
}
