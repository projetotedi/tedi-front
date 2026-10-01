import type { PermissionsDto } from "@api/generated/model";
import { Role } from "@shared/lib/role";

/**
 * Espelha o back (tedi-back/docs/PERMISSIONS.md); só para testes.
 * O tipo `PermissionsDto` faz o typecheck falhar se uma chave mudar; se só um valor mudar,
 * a divergência não é pega automaticamente: conferir contra o PERMISSIONS.md no PR.
 */
const MEMBER: PermissionsDto = {
  "account.manageOwn": "own",
  "members.list": "none",
  "members.view": "none",
  "members.edit": "none",
  "members.deactivate": "none",
  "assignments.create": "none",
  "invites.manage": "none",
  "access.manage": "none",
  "catalog.view": "all",
  "lessonPlans.manage": "none",
  "courses.manage": "none",
  "courses.duplicateArchive": "none",
  "classes.view": "all",
  "classes.manage": "none",
  "enrollments.manage": "none",
  "lessons.view": "all",
  "assignments.manageOwn": "own",
  "lessons.manage": "none",
  "assignments.review": "none",
  "attendance.takeStudents": "allocated",
  "attendance.confirmMember": "lessonTeacher",
  "attendance.correct": "none",
  "students.view": "all",
  "students.manage": "none",
  "students.delete": "none",
  "hours.viewOthers": "none",
  "hours.logForOthers": "none",
  "hours.review": "none",
  "hours.export": "none",
};

const DIRECTOR: PermissionsDto = {
  "account.manageOwn": "own",
  "members.list": "all",
  "members.view": "department",
  "members.edit": "department",
  "members.deactivate": "none",
  "assignments.create": "all",
  "invites.manage": "none",
  "access.manage": "none",
  "catalog.view": "all",
  "lessonPlans.manage": "all",
  "courses.manage": "all",
  "courses.duplicateArchive": "all",
  "classes.view": "all",
  "classes.manage": "all",
  "enrollments.manage": "all",
  "lessons.view": "all",
  "assignments.manageOwn": "own",
  "lessons.manage": "all",
  "assignments.review": "all",
  "attendance.takeStudents": "all",
  "attendance.confirmMember": "all",
  "attendance.correct": "all",
  "students.view": "all",
  "students.manage": "all",
  "students.delete": "none",
  "hours.viewOthers": "department",
  "hours.logForOthers": "department",
  "hours.review": "none",
  "hours.export": "department",
};

const COORDINATOR: PermissionsDto = {
  ...DIRECTOR,
  "members.view": "all",
  "members.edit": "all",
  "members.deactivate": "all",
  "invites.manage": "all",
  "access.manage": "all",
  "students.delete": "all",
  "hours.viewOthers": "all",
  "hours.logForOthers": "all",
  "hours.review": "all",
  "hours.export": "all",
};

const SUPERADMIN = Object.fromEntries(
  Object.keys(MEMBER).map((permission) => [permission, "all"]),
) as unknown as PermissionsDto;

export const PERMISSIONS_BY_ROLE: Record<Role, PermissionsDto> = {
  [Role.member]: MEMBER,
  [Role.director]: DIRECTOR,
  [Role.coordinator]: COORDINATOR,
  [Role.superadmin]: SUPERADMIN,
};
