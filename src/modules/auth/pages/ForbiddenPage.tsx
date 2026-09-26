import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { useDocumentTitle } from "@shared/hooks/useDocumentTitle";
import { useSetHeaderTitle } from "@shared/hooks/header-title";
import type { Role } from "@shared/lib/role";
import { Button } from "@shared/ui";

import { useAuth } from "../hooks/useAuth";
import { roleLabelKey } from "../lib/role-label";

export interface ForbiddenPageProps {
  /** Perfil que a rota exige; sem ele o quadro "Perfil necessário / Seu perfil" não aparece. */
  requiredRole?: Role;
}

/**
 * Tela 403 do Figma (frame 64:3096), renderizada no lugar pela RequireRole quando o perfil não
 * atende o `minRole` da rota. A sessão continua ativa e a URL não muda (decisão 18).
 * O cabeçalho passa a dizer "Acesso restrito" enquanto ela está montada.
 */
export function ForbiddenPage({ requiredRole }: ForbiddenPageProps) {
  const { t } = useTranslation("auth");
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const headingId = useId();

  useDocumentTitle(t("forbidden.headerTitle"));
  useSetHeaderTitle(t("forbidden.headerTitle"));

  const requiredKey = requiredRole ? roleLabelKey(requiredRole) : null;
  const currentKey = user ? roleLabelKey(user.role) : null;

  // `key === "default"` é a primeira entrada do histórico: não há tela anterior para voltar.
  function goBack() {
    if (location.key === "default") navigate("/");
    else navigate(-1);
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-1 items-center justify-center">
      <div className="flex w-full max-w-360 flex-col items-center rounded-3xl bg-white px-6 py-16 text-center shadow-tedi-card lg:py-24">
        <p
          aria-hidden="true"
          className="text-[80px] leading-none font-bold tracking-[-2px] text-tedi-texture-light lg:text-[120px]"
        >
          403
        </p>
        <h2 id={headingId} className="mt-3 text-[28px] font-semibold text-foreground">
          {t("forbidden.title")}
        </h2>
        <p className="mt-2 max-w-140 text-base leading-6 text-muted">
          {t("forbidden.description")}
        </p>

        {requiredKey && currentKey ? (
          <p className="mt-5 rounded-[10px] bg-tedi-info-subtle px-4 py-2.5 text-sm font-medium whitespace-pre-wrap text-foreground">
            {t("forbidden.profiles", { required: t(requiredKey), current: t(currentKey) })}
          </p>
        ) : null}

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="tertiary"
            className="rounded-3xl px-4 text-tedi-avatar-foreground"
            onPress={goBack}
          >
            {t("forbidden.back")}
          </Button>
          {/* Ainda não há tela "Meu perfil"; até existir, leva à página inicial. */}
          <Button className="rounded-3xl px-4" onPress={() => navigate("/")}>
            {t("forbidden.profile")}
          </Button>
        </div>

        <p className="mt-6 max-w-140 text-sm leading-[18px] text-muted">{t("forbidden.help")}</p>
      </div>
    </section>
  );
}
