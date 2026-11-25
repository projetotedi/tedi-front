import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AccessResponseDto } from "@api/generated/model";
import { Role } from "@shared/lib/role";

import { MemberSummary } from "../components/MemberSummary";
import { buildAccess } from "./handlers";
import { renderWithProviders } from "./test-utils";

function withRa(access: AccessResponseDto, ra: unknown): AccessResponseDto {
  return { ...access, ra: ra as AccessResponseDto["ra"] };
}

describe("MemberSummary", () => {
  it("shows the name and the RA, then the current role", async () => {
    await renderWithProviders(
      <MemberSummary
        access={buildAccess({ name: "Ana Torres", ra: "2024RA0001", role: Role.coordinator })}
      />,
    );

    expect(screen.getByText("Ana Torres · RA 2024RA0001")).toHaveClass("font-semibold");
    expect(screen.getByText("Perfil atual: Coordenadora")).toBeInTheDocument();
  });

  it.each([
    ["null", null],
    ["an empty string", ""],
  ])("shows only the name when the RA is %s", async (_label, ra) => {
    await renderWithProviders(
      <MemberSummary access={withRa(buildAccess({ name: "Caio Lopes" }), ra)} />,
    );

    expect(screen.getByText("Caio Lopes")).toBeInTheDocument();
    expect(screen.queryByText(/RA/)).not.toBeInTheDocument();
  });

  it("labels a director as Diretor and a superadmin as Coordenadora", async () => {
    const { rerender } = await renderWithProviders(
      <MemberSummary access={buildAccess({ role: Role.director })} />,
    );
    expect(screen.getByText("Perfil atual: Diretor")).toBeInTheDocument();

    rerender(<MemberSummary access={buildAccess({ role: Role.superadmin })} />);
    expect(screen.getByText("Perfil atual: Coordenadora")).toBeInTheDocument();
  });

  it("leaves out the role line when the person has no role", async () => {
    await renderWithProviders(<MemberSummary access={buildAccess({ role: null })} />);

    expect(screen.queryByText(/Perfil atual/)).not.toBeInTheDocument();
  });

  it("does not claim a date the contract does not provide", async () => {
    await renderWithProviders(<MemberSummary access={buildAccess()} />);

    expect(screen.queryByText(/acesso ativo desde/i)).not.toBeInTheDocument();
  });
});
