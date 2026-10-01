import { describe, expect, it } from "vitest";

import type { PermissionsDto } from "@api/generated/model";
import { PERMISSIONS_BY_ROLE } from "@modules/auth/__tests__/fixtures/permissions";

import { can, scopeOf, type PermissionSubject } from "../permissions";
import { Role } from "../role";

const SELF = "person-self";
const OTHER = "person-other";

function userWith(role: Role, overrides: Partial<PermissionsDto> = {}): PermissionSubject {
  return { id: SELF, permissions: { ...PERMISSIONS_BY_ROLE[role], ...overrides } };
}

describe("can", () => {
  it("returns false without a user", () => {
    expect(can(null, "catalog.view")).toBe(false);
    expect(can(undefined, "catalog.view")).toBe(false);
    expect(scopeOf(null, "catalog.view")).toBe("none");
  });

  it("returns false when the scope is none", () => {
    const user = userWith(Role.member);
    expect(can(user, "members.list")).toBe(false);
    expect(can(user, "members.list", { serverGrant: true })).toBe(false);
  });

  it("returns true for scope all with or without target", () => {
    const user = userWith(Role.coordinator);
    expect(can(user, "members.view")).toBe(true);
    expect(can(user, "members.view", { personId: OTHER })).toBe(true);
    expect(can(user, "members.view", { serverGrant: false })).toBe(true);
  });

  it("own: true without target, true on oneself, false on another person", () => {
    const user = userWith(Role.member);
    expect(can(user, "account.manageOwn")).toBe(true);
    expect(can(user, "account.manageOwn", { personId: SELF })).toBe(true);
    expect(can(user, "account.manageOwn", { personId: OTHER })).toBe(false);
    expect(can(user, "account.manageOwn", {})).toBe(false);
  });

  it("department/allocated/lessonTeacher: true without target", () => {
    expect(can(userWith(Role.director), "members.view")).toBe(true);
    expect(can(userWith(Role.member), "attendance.takeStudents")).toBe(true);
    expect(can(userWith(Role.member), "attendance.confirmMember")).toBe(true);
  });

  it("department/allocated/lessonTeacher: with target follows serverGrant", () => {
    const cases: [PermissionSubject, Parameters<typeof can>[1]][] = [
      [userWith(Role.director), "members.view"],
      [userWith(Role.member), "attendance.takeStudents"],
      [userWith(Role.member), "attendance.confirmMember"],
    ];
    for (const [user, permission] of cases) {
      expect(can(user, permission, { personId: OTHER, serverGrant: true })).toBe(true);
      expect(can(user, permission, { personId: OTHER, serverGrant: false })).toBe(false);
      expect(can(user, permission, { personId: OTHER })).toBe(false);
    }
  });

  it("never allows attendance.confirmMember on oneself, even with scope all", () => {
    for (const role of [Role.director, Role.coordinator, Role.superadmin]) {
      const user = userWith(role);
      expect(scopeOf(user, "attendance.confirmMember")).toBe("all");
      expect(can(user, "attendance.confirmMember", { personId: SELF })).toBe(false);
      expect(can(user, "attendance.confirmMember", { personId: SELF, serverGrant: true })).toBe(
        false,
      );
      expect(can(user, "attendance.confirmMember", { personId: OTHER })).toBe(true);
    }
  });

  it("member: cannot hours.viewOthers nor access.manage", () => {
    const user = userWith(Role.member);
    expect(can(user, "hours.viewOthers")).toBe(false);
    expect(can(user, "access.manage")).toBe(false);
  });

  it("director: can members.edit when the server grants the department, cannot members.deactivate", () => {
    const user = userWith(Role.director);
    expect(can(user, "members.edit", { personId: OTHER, serverGrant: true })).toBe(true);
    expect(can(user, "members.edit", { personId: OTHER, serverGrant: false })).toBe(false);
    expect(can(user, "members.deactivate")).toBe(false);
    expect(can(user, "members.deactivate", { personId: OTHER, serverGrant: true })).toBe(false);
  });

  it("member: attendance.takeStudents only when the server grants it (canTakeAttendance)", () => {
    const user = userWith(Role.member);
    expect(can(user, "attendance.takeStudents", { serverGrant: true })).toBe(true);
    expect(can(user, "attendance.takeStudents", { serverGrant: false })).toBe(false);
  });

  it("member: attendance.confirmMember only when the server grants it (canConfirmMembers)", () => {
    const user = userWith(Role.member);
    expect(can(user, "attendance.confirmMember", { personId: OTHER, serverGrant: true })).toBe(
      true,
    );
    expect(can(user, "attendance.confirmMember", { personId: OTHER, serverGrant: false })).toBe(
      false,
    );
    expect(can(user, "attendance.confirmMember", { personId: SELF, serverGrant: true })).toBe(
      false,
    );
  });
});
