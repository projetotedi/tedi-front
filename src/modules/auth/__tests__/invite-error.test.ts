import { describe, expect, it } from "vitest";

import {
  toAcceptFieldError,
  toInviteErrorKey,
  toRegistrationFieldErrors,
} from "../lib/invite-error";
import { FORM_FIELD_ORDER } from "../schemas/accept-invite-form.schema";

function apiError(statusCode: number, error?: string, details?: unknown) {
  return Object.assign(new Error("api error"), { statusCode, error, details });
}

function validationFailed(...fields: string[]) {
  return apiError(
    400,
    "VALIDATION_FAILED",
    fields.map((field) => ({ field, message: `${field} is invalid` })),
  );
}

describe("toInviteErrorKey", () => {
  it("maps 400 INVALID_INVITE (missing, used, revoked or expired link)", () => {
    expect(toInviteErrorKey(apiError(400, "INVALID_INVITE"))).toBe("invalidInvite");
  });

  it("maps 409 RA_ALREADY_IN_USE to raInUse", () => {
    expect(toInviteErrorKey(apiError(409, "RA_ALREADY_IN_USE"))).toBe("raInUse");
  });

  it("maps 409 EMAIL_ALREADY_IN_USE to emailInUse", () => {
    expect(toInviteErrorKey(apiError(409, "EMAIL_ALREADY_IN_USE"))).toBe("emailInUse");
  });

  it("maps 400 DEPARTMENT_NOT_FOUND to departmentNotFound", () => {
    expect(toInviteErrorKey(apiError(400, "DEPARTMENT_NOT_FOUND"))).toBe("departmentNotFound");
  });

  it("maps 400 VALIDATION_FAILED to invalidData, with or without details", () => {
    expect(toInviteErrorKey(validationFailed("registration.cpf"))).toBe("invalidData");
    expect(toInviteErrorKey(apiError(400, "VALIDATION_FAILED"))).toBe("invalidData");
  });

  it("maps a network failure (fetch rejects with a TypeError)", () => {
    expect(toInviteErrorKey(new TypeError("Failed to fetch"))).toBe("network");
  });

  it.each([502, 503, 504])("maps a %i gateway error to network", (statusCode) => {
    expect(toInviteErrorKey(apiError(statusCode))).toBe("network");
  });

  it("maps a gateway error to network even when its error field is not a code of the invite", () => {
    expect(toInviteErrorKey(apiError(502, "Bad Gateway"))).toBe("network");
    expect(toInviteErrorKey(apiError(503, "SERVICE_UNAVAILABLE"))).toBe("network");
    expect(toInviteErrorKey(apiError(504, "GATEWAY_TIMEOUT"))).toBe("network");
  });

  it.each([
    ["INVALID_INVITE", "invalidInvite"],
    ["RA_ALREADY_IN_USE", "raInUse"],
    ["EMAIL_ALREADY_IN_USE", "emailInUse"],
    ["DEPARTMENT_NOT_FOUND", "departmentNotFound"],
    ["VALIDATION_FAILED", "invalidData"],
  ])("keeps the known code %s even when the status is a gateway error", (code, expected) => {
    for (const statusCode of [502, 503, 504]) {
      expect(toInviteErrorKey(apiError(statusCode, code))).toBe(expected);
    }
  });

  it.each([500, 501, 505])(
    "keeps a %i as unknown: the API answered, it is not a connection failure",
    (statusCode) => {
      expect(toInviteErrorKey(apiError(statusCode))).toBe("unknown");
    },
  );

  it("does not confuse an invite code with the login codes", () => {
    expect(toInviteErrorKey(apiError(401, "INVALID_CREDENTIALS"))).toBe("unknown");
    expect(toInviteErrorKey(apiError(429, "TOO_MANY_ATTEMPTS"))).toBe("unknown");
  });

  it("maps an error payload without the error code to unknown", () => {
    expect(toInviteErrorKey({ statusCode: 400, message: "Bad request." })).toBe("unknown");
    expect(toInviteErrorKey(apiError(409))).toBe("unknown");
  });

  it("maps a 502 answered with an HTML page (no error code) to network", () => {
    const proxyError = Object.assign(new Error("Bad Gateway"), { statusCode: 502 });

    expect(toInviteErrorKey(proxyError)).toBe("network");
  });

  it.each([
    ["a server error", apiError(500, "Internal Server Error")],
    ["an unrelated Error", new Error("boom")],
    ["undefined", undefined],
    ["null", null],
    ["a loose string", "INVALID_INVITE"],
    ["an empty object", {}],
  ])("falls back to unknown for %s", (_label, error) => {
    expect(toInviteErrorKey(error)).toBe("unknown");
  });
});

describe("toAcceptFieldError", () => {
  it("points RA_ALREADY_IN_USE at the RA field", () => {
    expect(toAcceptFieldError("raInUse")).toBe("ra");
  });

  it("points EMAIL_ALREADY_IN_USE at the email field", () => {
    expect(toAcceptFieldError("emailInUse")).toBe("email");
  });

  it.each(["invalidInvite", "network", "unknown"] as const)(
    "does not point %s at any field",
    (key) => {
      expect(toAcceptFieldError(key)).toBeNull();
    },
  );
});

describe("toRegistrationFieldErrors", () => {
  it("maps 409 RA_ALREADY_IN_USE to the ra field", () => {
    expect(toRegistrationFieldErrors(apiError(409, "RA_ALREADY_IN_USE"))).toEqual([
      { field: "ra", message: "invite.errors.raInUse" },
    ]);
  });

  it("maps 409 EMAIL_ALREADY_IN_USE to the personal e-mail, which is the one the API compares", () => {
    expect(toRegistrationFieldErrors(apiError(409, "EMAIL_ALREADY_IN_USE"))).toEqual([
      { field: "personalEmail", message: "invite.errors.emailInUse" },
    ]);
  });

  it("maps 400 DEPARTMENT_NOT_FOUND to the department field", () => {
    expect(toRegistrationFieldErrors(apiError(400, "DEPARTMENT_NOT_FOUND"))).toEqual([
      { field: "departmentId", message: "invite.errors.departmentNotFound" },
    ]);
  });

  it("maps the 400 registration.cpf error to the cpf field", () => {
    expect(toRegistrationFieldErrors(validationFailed("registration.cpf"))).toEqual([
      { field: "cpf", message: "invite.validation.cpfInvalid" },
    ]);
  });

  it.each([
    ["registration.name", "name", "invite.validation.nameRequired"],
    ["registration.ra", "ra", "invite.validation.raRequired"],
    ["registration.personalEmail", "personalEmail", "invite.validation.personalEmailInvalid"],
    ["registration.birthDate", "birthDate", "invite.validation.birthDateInvalid"],
    ["registration.cpf", "cpf", "invite.validation.cpfInvalid"],
    ["registration.phone", "phone", "invite.validation.phoneInvalid"],
    ["registration.address", "address", "invite.validation.addressMax"],
    ["registration.city", "city", "invite.validation.cityMax"],
    ["registration.state", "state", "invite.validation.stateInvalid"],
    [
      "registration.institutionalEmail",
      "institutionalEmail",
      "invite.validation.institutionalEmailInvalid",
    ],
    ["registration.course", "course", "invite.validation.courseRequired"],
    ["registration.semester", "semester", "invite.validation.semesterInvalid"],
    ["registration.className", "className", "invite.validation.classNameRequired"],
    ["registration.departmentId", "departmentId", "invite.validation.departmentInvalid"],
    [
      "registration.volunteerTermUrl",
      "volunteerTermUrl",
      "invite.validation.volunteerTermUrlInvalid",
    ],
    ["password", "password", "invite.validation.passwordMin"],
  ])("maps the 400 error on %s to the %s field", (serverField, field, message) => {
    expect(toRegistrationFieldErrors(validationFailed(serverField))).toEqual([{ field, message }]);
  });

  it("maps every field the form has, except the confirmation, which the API does not know", () => {
    const serverFields = [
      ...FORM_FIELD_ORDER.filter(
        (field) => field !== "password" && field !== "passwordConfirmation",
      )
        .map((field) => `registration.${field}`)
        .reverse(),
      "password",
    ];

    const fields = toRegistrationFieldErrors(validationFailed(...serverFields)).map(
      (error) => error.field,
    );

    expect(fields).toEqual(FORM_FIELD_ORDER.filter((field) => field !== "passwordConfirmation"));
  });

  it("returns the errors in the order of the form, whatever the order of the API", () => {
    const errors = toRegistrationFieldErrors(
      validationFailed(
        "password",
        "registration.state",
        "registration.cpf",
        "registration.ra",
        "registration.name",
      ),
    );

    expect(errors.map((error) => error.field)).toEqual(["ra", "name", "cpf", "state", "password"]);
  });

  it("reports a field once, even when the API names it twice", () => {
    const errors = toRegistrationFieldErrors(
      validationFailed("registration.cpf", "registration.phone", "registration.cpf"),
    );

    expect(errors.map((error) => error.field)).toEqual(["cpf", "phone"]);
  });

  it("ignores a field the form does not have", () => {
    const errors = toRegistrationFieldErrors(
      validationFailed("registration.nickname", "registration.cpf", "token", "email"),
    );

    expect(errors).toEqual([{ field: "cpf", message: "invite.validation.cpfInvalid" }]);
  });

  it("ignores the registration object named alone: no field to point at", () => {
    expect(toRegistrationFieldErrors(validationFailed("registration"))).toEqual([]);
  });

  it.each(["constructor", "__proto__", "registration.constructor", "registration.__proto__"])(
    "ignores the field name %j, which exists on every object",
    (field) => {
      expect(toRegistrationFieldErrors(validationFailed(field))).toEqual([]);
    },
  );

  it("returns nothing for a VALIDATION_FAILED without details", () => {
    expect(toRegistrationFieldErrors(apiError(400, "VALIDATION_FAILED"))).toEqual([]);
    expect(toRegistrationFieldErrors(apiError(400, "VALIDATION_FAILED", []))).toEqual([]);
  });

  it.each([
    ["a string", "registration.cpf"],
    ["an object", { field: "registration.cpf" }],
    ["null", null],
  ])("returns nothing when details is %s instead of a list", (_label, details) => {
    expect(toRegistrationFieldErrors(apiError(400, "VALIDATION_FAILED", details))).toEqual([]);
  });

  it("skips the details that are not an object with a text field", () => {
    const error = apiError(400, "VALIDATION_FAILED", [
      null,
      "registration.ra",
      42,
      { field: 7 },
      { message: "no field" },
      { field: "registration.cpf", message: "cpf must be a valid CPF" },
    ]);

    expect(toRegistrationFieldErrors(error)).toEqual([
      { field: "cpf", message: "invite.validation.cpfInvalid" },
    ]);
  });

  it.each([
    ["an invalid invite", apiError(400, "INVALID_INVITE")],
    ["a network failure", new TypeError("Failed to fetch")],
    ["a gateway error", apiError(503, "SERVICE_UNAVAILABLE")],
    ["a server error", apiError(500, "INTERNAL_SERVER_ERROR")],
    ["an unknown value", undefined],
  ])("points at no field for %s", (_label, error) => {
    expect(toRegistrationFieldErrors(error)).toEqual([]);
  });

  it("does not read details of an error that is not a VALIDATION_FAILED", () => {
    const error = apiError(500, "INTERNAL_SERVER_ERROR", [
      { field: "registration.cpf", message: "x" },
    ]);

    expect(toRegistrationFieldErrors(error)).toEqual([]);
  });
});
