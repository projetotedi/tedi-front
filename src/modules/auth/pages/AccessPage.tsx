import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { PageTitle } from "@shared/components/PageTitle";
import { useDocumentTitle } from "@shared/hooks/useDocumentTitle";
import { Tabs } from "@shared/ui";

import { AccessTable } from "../components/AccessTable";
import { CreateInviteDialog } from "../components/CreateInviteDialog";
import { InvitesTable } from "../components/InvitesTable";

type AccessTab = "people" | "invites";

/**
 * `/access`, sob `RequireRole minRole={Role.coordinator}`. A coordenadora vê quem tem acesso
 * (aba Pessoas), os convites gerados (aba Convites) e gera novos convites por perfil.
 */
export function AccessPage(): ReactElement {
  const { t } = useTranslation("auth");
  const [tab, setTab] = useState<AccessTab>("people");

  useDocumentTitle(t("access.title"));

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle>{t("access.title")}</PageTitle>
        {/* Fora das abas: continua visível em Pessoas e em Convites. */}
        <CreateInviteDialog onCreated={() => setTab("invites")} />
      </div>
      <Tabs
        label={t("access.title")}
        selectedKey={tab}
        onSelectionChange={(key) => setTab(key === "invites" ? "invites" : "people")}
        items={[
          { id: "people", label: t("access.tabs.people"), content: <AccessTable /> },
          { id: "invites", label: t("access.tabs.invites"), content: <InvitesTable /> },
        ]}
      />
    </section>
  );
}
