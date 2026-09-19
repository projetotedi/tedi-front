import { describe, expect, it } from "vitest";

import { Role, roleSatisfies } from "../role";

describe("roleSatisfies", () => {
  describe("null / undefined userRole", () => {
    it("returns false for null", () => {
      expect(roleSatisfies(null, Role.member)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(roleSatisfies(undefined, Role.member)).toBe(false);
    });
  });

  describe("hierarchy: member < director < coordinator", () => {
    it("member satisfies member", () => {
      expect(roleSatisfies(Role.member, Role.member)).toBe(true);
    });

    it("member does not satisfy director", () => {
      expect(roleSatisfies(Role.member, Role.director)).toBe(false);
    });

    it("member does not satisfy coordinator", () => {
      expect(roleSatisfies(Role.member, Role.coordinator)).toBe(false);
    });

    it("director satisfies member", () => {
      expect(roleSatisfies(Role.director, Role.member)).toBe(true);
    });

    it("director satisfies director", () => {
      expect(roleSatisfies(Role.director, Role.director)).toBe(true);
    });

    it("director does not satisfy coordinator", () => {
      expect(roleSatisfies(Role.director, Role.coordinator)).toBe(false);
    });

    it("coordinator satisfies member", () => {
      expect(roleSatisfies(Role.coordinator, Role.member)).toBe(true);
    });

    it("coordinator satisfies director", () => {
      expect(roleSatisfies(Role.coordinator, Role.director)).toBe(true);
    });

    it("coordinator satisfies coordinator", () => {
      expect(roleSatisfies(Role.coordinator, Role.coordinator)).toBe(true);
    });
  });

  describe("superadmin satisfies any role", () => {
    it("superadmin satisfies member", () => {
      expect(roleSatisfies(Role.superadmin, Role.member)).toBe(true);
    });

    it("superadmin satisfies director", () => {
      expect(roleSatisfies(Role.superadmin, Role.director)).toBe(true);
    });

    it("superadmin satisfies coordinator", () => {
      expect(roleSatisfies(Role.superadmin, Role.coordinator)).toBe(true);
    });

    it("superadmin satisfies superadmin", () => {
      expect(roleSatisfies(Role.superadmin, Role.superadmin)).toBe(true);
    });
  });
});
