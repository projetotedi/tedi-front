import { describe, expect, it } from "vitest";

import {
  ApproveMemberRegistrationBody,
  RejectMemberRegistrationBody,
} from "@api/generated/zod/people/people";
import { Role } from "@shared/lib/role";

import {
  buildReviewDefaults,
  createApproveReviewSchema,
  isInvitableRole,
  MIN_JOINED_AT,
  NO_DEPARTMENT,
  REGISTRATION_REVIEW_LIMITS,
  rejectReviewSchema,
  requiresDepartment,
  toApproveBody,
  toRejectBody,
  type RegistrationReviewFormValues,
} from "../schemas/registration-review.schema";
import { buildMemberRegistration, REVIEW_DEPARTMENTS } from "./member-registration-handlers";

const TODAY = "2026-11-15";
const [PEDAGOGY, TECHNOLOGY] = REVIEW_DEPARTMENTS;
const DEPARTMENT_IDS: ReadonlySet<string> = new Set(
  REVIEW_DEPARTMENTS.map((department) => department.id),
);

function validValues(
  overrides: Partial<RegistrationReviewFormValues> = {},
): RegistrationReviewFormValues {
  return {
    role: Role.member,
    departmentId: TECHNOLOGY.id,
    mainFunction: "Monitoria em sala",
    joinedAt: "2026-09-18",
    note: "",
    ...overrides,
  };
}

type Issue = { path: string; message: string };

function approveIssues(
  values: RegistrationReviewFormValues,
  departmentIds: ReadonlySet<string> = DEPARTMENT_IDS,
): Issue[] {
  const result = createApproveReviewSchema(departmentIds, TODAY).safeParse(values);
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

function rejectIssues(values: RegistrationReviewFormValues): Issue[] {
  const result = rejectReviewSchema.safeParse(values);
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

describe("constants", () => {
  it("uses a value for no department that is never an id", () => {
    expect(NO_DEPARTMENT).toBe("none");
    expect(DEPARTMENT_IDS.has(NO_DEPARTMENT)).toBe(false);
  });

  it("starts the allowed range of the joining date in 2000", () => {
    expect(MIN_JOINED_AT).toBe("2000-01-01");
  });

  it("takes the length limits from the contract", () => {
    expect(REGISTRATION_REVIEW_LIMITS).toEqual({
      maxMainFunctionLength: 100,
      maxNoteLength: 500,
    });
  });
});

describe("isInvitableRole", () => {
  it.each([Role.member, Role.director, Role.coordinator])("accepts %s", (role) => {
    expect(isInvitableRole(role)).toBe(true);
  });

  it.each([Role.superadmin, "", "admin", "Member"])("rejects %j", (role) => {
    expect(isInvitableRole(role)).toBe(false);
  });
});

describe("requiresDepartment", () => {
  it("requires a department for member and director", () => {
    expect(requiresDepartment(Role.member)).toBe(true);
    expect(requiresDepartment(Role.director)).toBe(true);
  });

  it("does not require it for the coordinator", () => {
    expect(requiresDepartment(Role.coordinator)).toBe(false);
  });

  it("requires it while no profile is chosen", () => {
    expect(requiresDepartment("")).toBe(true);
  });
});

describe("createApproveReviewSchema", () => {
  it("accepts a complete valid approval", () => {
    expect(approveIssues(validValues())).toEqual([]);
  });

  it("accepts the three profiles of the invite", () => {
    for (const role of [Role.member, Role.director, Role.coordinator]) {
      expect(approveIssues(validValues({ role })), role).toEqual([]);
    }
  });

  describe("role", () => {
    it("refuses superadmin, which the back answers with INVALID_ROLE", () => {
      expect(approveIssues(validValues({ role: Role.superadmin }))).toEqual([
        { path: "role", message: "roleRequired" },
      ]);
    });

    it("refuses an empty profile", () => {
      expect(approveIssues(validValues({ role: "" }))).toContainEqual({
        path: "role",
        message: "roleRequired",
      });
    });
  });

  describe("department", () => {
    it.each([Role.member, Role.director])("is required for %s", (role) => {
      for (const departmentId of ["", NO_DEPARTMENT]) {
        expect(approveIssues(validValues({ role, departmentId })), departmentId).toEqual([
          { path: "departmentId", message: "departmentRequired" },
        ]);
      }
    });

    it("must be one of the listed departments", () => {
      expect(
        approveIssues(validValues({ departmentId: "01952ef7-0000-7000-8000-0000000000ff" })),
      ).toEqual([{ path: "departmentId", message: "departmentRequired" }]);
    });

    it("is required while the list is empty or not loaded yet", () => {
      expect(approveIssues(validValues(), new Set())).toEqual([
        { path: "departmentId", message: "departmentRequired" },
      ]);
    });

    it("accepts any listed department", () => {
      expect(approveIssues(validValues({ departmentId: PEDAGOGY.id }))).toEqual([]);
    });

    it("is optional for the coordinator: none, empty or a listed one", () => {
      for (const departmentId of [NO_DEPARTMENT, "", PEDAGOGY.id]) {
        expect(
          approveIssues(validValues({ role: Role.coordinator, departmentId })),
          departmentId,
        ).toEqual([]);
      }
    });

    it("is optional for the coordinator even when the list is empty", () => {
      expect(
        approveIssues(
          validValues({ role: Role.coordinator, departmentId: NO_DEPARTMENT }),
          new Set(),
        ),
      ).toEqual([]);
    });

    it("asks for it again when the coordinator becomes a member", () => {
      expect(
        approveIssues(validValues({ role: Role.member, departmentId: NO_DEPARTMENT })),
      ).toEqual([{ path: "departmentId", message: "departmentRequired" }]);
    });
  });

  describe("main function", () => {
    it.each(["", "   "])("is required (%j)", (mainFunction) => {
      expect(approveIssues(validValues({ mainFunction }))).toEqual([
        { path: "mainFunction", message: "mainFunctionRequired" },
      ]);
    });

    it("accepts 100 characters and rejects 101", () => {
      expect(approveIssues(validValues({ mainFunction: "a".repeat(100) }))).toEqual([]);
      expect(approveIssues(validValues({ mainFunction: "a".repeat(101) }))).toEqual([
        { path: "mainFunction", message: "mainFunctionMax" },
      ]);
    });

    it("counts the characters after trimming", () => {
      expect(approveIssues(validValues({ mainFunction: `  ${"a".repeat(100)}  ` }))).toEqual([]);
    });
  });

  describe("joining date", () => {
    it.each([
      ["today", TODAY],
      ["the first allowed day", MIN_JOINED_AT],
      ["a day in the middle", "2026-09-18"],
    ])("accepts %s", (_label, joinedAt) => {
      expect(approveIssues(validValues({ joinedAt }))).toEqual([]);
    });

    it.each([
      ["a future date", "2999-01-01"],
      ["tomorrow", "2026-11-16"],
      ["the day before the first allowed day", "1999-12-31"],
      ["a date typed as dd/mm/aaaa", "18/09/2026"],
      ["a date that does not exist", "2026-02-30"],
      ["an empty date", ""],
    ])("rejects %s", (_label, joinedAt) => {
      expect(approveIssues(validValues({ joinedAt }))).toEqual([
        { path: "joinedAt", message: "joinedAtInvalid" },
      ]);
    });
  });

  describe("note", () => {
    it("is optional when approving", () => {
      expect(approveIssues(validValues({ note: "" }))).toEqual([]);
      expect(approveIssues(validValues({ note: "   " }))).toEqual([]);
    });

    it("accepts 500 characters and rejects 501", () => {
      expect(approveIssues(validValues({ note: "a".repeat(500) }))).toEqual([]);
      expect(approveIssues(validValues({ note: "a".repeat(501) }))).toEqual([
        { path: "note", message: "noteMax" },
      ]);
    });
  });

  it("reports every problem at once, each on its own field", () => {
    const issues = approveIssues(
      validValues({ departmentId: "", mainFunction: "", joinedAt: "2999-01-01" }),
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        { path: "mainFunction", message: "mainFunctionRequired" },
        { path: "joinedAt", message: "joinedAtInvalid" },
        { path: "departmentId", message: "departmentRequired" },
      ]),
    );
    expect(issues).toHaveLength(3);
  });

  it("follows the day it is given, not the clock", () => {
    const schema = createApproveReviewSchema(DEPARTMENT_IDS, "2026-09-18");

    expect(schema.safeParse(validValues({ joinedAt: "2026-09-18" })).success).toBe(true);
    expect(schema.safeParse(validValues({ joinedAt: "2026-09-19" })).success).toBe(false);
  });
});

describe("rejectReviewSchema", () => {
  it("accepts a note", () => {
    expect(rejectIssues(validValues({ note: "O RA não confere com o termo." }))).toEqual([]);
  });

  it.each(["", "   "])("requires the note (%j)", (note) => {
    expect(rejectIssues(validValues({ note }))).toEqual([
      { path: "note", message: "noteRequired" },
    ]);
  });

  it("accepts 500 characters and rejects 501", () => {
    expect(rejectIssues(validValues({ note: "a".repeat(500) }))).toEqual([]);
    expect(rejectIssues(validValues({ note: "a".repeat(501) }))).toEqual([
      { path: "note", message: "noteMax" },
    ]);
  });

  it("does not look at the fields that only matter when approving", () => {
    expect(
      rejectIssues({
        role: Role.superadmin,
        departmentId: "",
        mainFunction: "",
        joinedAt: "2999-01-01",
        note: "Dados incompletos.",
      }),
    ).toEqual([]);
  });
});

describe("toApproveBody", () => {
  it("builds the body of the contract", () => {
    const body = toApproveBody(
      validValues({ role: Role.director, departmentId: PEDAGOGY.id, note: "Bem-vindo." }),
      DEPARTMENT_IDS,
    );

    expect(body).toEqual({
      role: Role.director,
      departmentId: PEDAGOGY.id,
      mainFunction: "Monitoria em sala",
      joinedAt: "2026-09-18",
      note: "Bem-vindo.",
    });
    expect(ApproveMemberRegistrationBody.safeParse(body).success).toBe(true);
  });

  it("trims the main function and the note", () => {
    const body = toApproveBody(
      validValues({ mainFunction: "  Monitoria em sala  ", note: "  Bem-vindo.  " }),
      DEPARTMENT_IDS,
    );

    expect(body.mainFunction).toBe("Monitoria em sala");
    expect(body.note).toBe("Bem-vindo.");
  });

  it("sends null for a blank note", () => {
    expect(toApproveBody(validValues({ note: "" }), DEPARTMENT_IDS).note).toBeNull();
    expect(toApproveBody(validValues({ note: "   " }), DEPARTMENT_IDS).note).toBeNull();
  });

  it.each([
    ["no department", NO_DEPARTMENT],
    ["nothing chosen", ""],
    ["a department the screen does not offer", "01952ef7-0000-7000-8000-0000000000ff"],
  ])("sends a null department for %s", (_label, departmentId) => {
    const body = toApproveBody(
      validValues({ role: Role.coordinator, departmentId }),
      DEPARTMENT_IDS,
    );

    expect(body.departmentId).toBeNull();
    expect(ApproveMemberRegistrationBody.safeParse(body).success).toBe(true);
  });

  it("does not send the department of the member while the list is not available", () => {
    expect(
      toApproveBody(validValues({ role: Role.coordinator, departmentId: TECHNOLOGY.id }), new Set())
        .departmentId,
    ).toBeNull();
  });

  it("refuses to build a body for a profile the validation cannot grant", () => {
    expect(() => toApproveBody(validValues({ role: Role.superadmin }), DEPARTMENT_IDS)).toThrow(
      RangeError,
    );
  });
});

describe("toRejectBody", () => {
  it("builds the body of the contract with the trimmed note", () => {
    const body = toRejectBody(validValues({ note: "  O RA não confere com o termo.  " }));

    expect(body).toEqual({ note: "O RA não confere com o termo." });
    expect(RejectMemberRegistrationBody.safeParse(body).success).toBe(true);
  });
});

describe("buildReviewDefaults", () => {
  it("starts from what the invite and the member indicated", () => {
    const registration = buildMemberRegistration({
      requestedRole: Role.director,
      mainFunction: "Monitoria em sala",
    });

    expect(buildReviewDefaults(registration, TODAY)).toEqual({
      role: Role.director,
      departmentId: TECHNOLOGY.id,
      mainFunction: "Monitoria em sala",
      joinedAt: "2026-09-18",
      note: "",
    });
  });

  it("keeps the profile of the invite when it is the member's or the coordinator's", () => {
    expect(
      buildReviewDefaults(buildMemberRegistration({ requestedRole: Role.member }), TODAY).role,
    ).toBe(Role.member);
    expect(
      buildReviewDefaults(buildMemberRegistration({ requestedRole: Role.coordinator }), TODAY).role,
    ).toBe(Role.coordinator);
  });

  it("falls back to member when the invite suggests superadmin or nothing", () => {
    expect(
      buildReviewDefaults(buildMemberRegistration({ requestedRole: Role.superadmin }), TODAY).role,
    ).toBe(Role.member);
    expect(buildReviewDefaults(buildMemberRegistration({ requestedRole: null }), TODAY).role).toBe(
      Role.member,
    );
  });

  it("leaves the department and the main function empty when the member did not indicate them", () => {
    const defaults = buildReviewDefaults(
      buildMemberRegistration({ department: null, mainFunction: null }),
      TODAY,
    );

    expect(defaults.departmentId).toBe("");
    expect(defaults.mainFunction).toBe("");
  });

  it("starts the joining date on the day the registration was sent, in São Paulo", () => {
    const lateAtNight = buildMemberRegistration({ submittedAt: "2026-09-19T02:00:00.000Z" });

    expect(buildReviewDefaults(lateAtNight, TODAY).joinedAt).toBe("2026-09-18");
  });

  it("starts the joining date today when there is no sending date", () => {
    expect(
      buildReviewDefaults(buildMemberRegistration({ submittedAt: null }), TODAY).joinedAt,
    ).toBe(TODAY);
    expect(
      buildReviewDefaults(buildMemberRegistration({ submittedAt: "not a date" }), TODAY).joinedAt,
    ).toBe(TODAY);
  });

  it("never starts the joining date in the future", () => {
    expect(
      buildReviewDefaults(
        buildMemberRegistration({ submittedAt: "2999-01-01T12:00:00.000Z" }),
        TODAY,
      ).joinedAt,
    ).toBe(TODAY);
  });

  it("starts with an empty note", () => {
    expect(
      buildReviewDefaults(buildMemberRegistration({ reviewNote: "Nota antiga" }), TODAY).note,
    ).toBe("");
  });

  it("produces values the approve schema accepts for a typical registration", () => {
    const defaults = buildReviewDefaults(
      buildMemberRegistration({ mainFunction: "Monitoria em sala" }),
      TODAY,
    );

    expect(approveIssues(defaults)).toEqual([]);
  });
});
