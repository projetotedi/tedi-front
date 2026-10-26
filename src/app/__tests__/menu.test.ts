import { describe, expect, it } from "vitest";

import i18n from "@shared/i18n";
import { groupMenuItems, MENU_GROUP_IDS } from "@shared/lib/menu";

import { appMenuGroups, appMenuItems, prototypeMenuItems } from "../menu";
import { prototypeRoutes } from "../prototype-routes";

/** Texto de uma chave de i18n (com namespace) no idioma pedido. */
const translate = (key: string, lng: string) => i18n.t(key, { lng });

/** A chave existe no idioma pedido, sem cair no idioma padrão (`i18n.exists` cai). */
function hasTranslation(key: string, lng: string): boolean {
  const [namespace, path] = key.split(":");

  return typeof i18n.getResource(lng, namespace, path) === "string";
}

describe("app menu", () => {
  it("appMenuGroups lists every MENU_GROUP_IDS once, in order", () => {
    expect(appMenuGroups.map((group) => group.id)).toEqual([...MENU_GROUP_IDS]);
  });

  it("groups the app menu in the Figma structure", () => {
    const outline = groupMenuItems(appMenuItems, appMenuGroups).map((section) => [
      translate(section.group.label, "pt-BR"),
      section.items.map((item) => translate(item.label, "pt-BR")),
    ]);

    expect(outline).toEqual([
      ["Catálogo", ["Cursos", "Planos de aula"]],
      ["Turmas", ["Turmas", "Matrículas"]],
      ["Aulas", ["Aulas", "Calendário"]],
      ["Pessoas", ["Alunos", "Membros"]],
      ["Horas", ["Banco de horas", "Validação de horas"]],
    ]);
  });

  it("keeps every item in a listed group", () => {
    const grouped = groupMenuItems(appMenuItems, appMenuGroups).flatMap((section) => section.items);

    expect(grouped).toHaveLength(appMenuItems.length);
    expect(appMenuItems).toHaveLength(10);
  });

  it("does not repeat a path", () => {
    const paths = appMenuItems.map((item) => item.path);

    expect(new Set(paths).size).toBe(paths.length);
  });

  it.each(["pt-BR", "en-US"])("translates every group and item label in %s", (lng) => {
    const keys = [...appMenuGroups, ...appMenuItems].map((entry) => entry.label);

    for (const key of keys) {
      expect(hasTranslation(key, lng), `${key} in ${lng}`).toBe(true);
    }
  });

  it("gives every group an icon", () => {
    for (const group of appMenuGroups) {
      expect(group.icon).toBeTruthy();
    }
  });

  it("every prototype item has a prototype route", () => {
    expect(prototypeRoutes.map((route) => `/${route.path}`)).toEqual(
      prototypeMenuItems.map((item) => item.path),
    );
  });

  it("puts the two new areas in the lessons and hours groups", () => {
    expect(appMenuItems).toContainEqual(
      expect.objectContaining({
        path: "/lessons/calendar",
        permission: "lessons.view",
        group: "lessons",
      }),
    );
    expect(appMenuItems).toContainEqual(
      expect.objectContaining({
        path: "/hours/review",
        permission: "hours.review",
        group: "hours",
      }),
    );
  });
});
