import { Outlet } from "react-router-dom";

/**
 * Layout das telas sem sessão: login e formulário público de pré-inscrição.
 * É a superfície voltada ao público idoso, então as exigências de acessibilidade
 * (fonte base 16px+, alvos de 44px, contraste 4.5:1) se aplicam com mais rigor aqui.
 */
export function PublicLayout() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 text-base">
      <Outlet />
    </main>
  );
}
