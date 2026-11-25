import { describe, expect, it } from "vitest";

import { MemberRegistrationStatus, MemberStatus } from "@api/generated/model";

import { MEMBER_ROW_STATUS_TONE, memberRowStatus } from "../lib/member-status";

describe("memberRowStatus", () => {
  it("says active for an approved member in the project", () => {
    expect(
      memberRowStatus({
        registrationStatus: MemberRegistrationStatus.approved,
        status: MemberStatus.active,
      }),
    ).toBe("active");
  });

  it("says active for a person with no registration to validate", () => {
    expect(memberRowStatus({ registrationStatus: null, status: MemberStatus.active })).toBe(
      "active",
    );
  });

  it("says inactive for a member who left the project", () => {
    expect(
      memberRowStatus({
        registrationStatus: MemberRegistrationStatus.approved,
        status: MemberStatus.inactive,
      }),
    ).toBe("inactive");
    expect(memberRowStatus({ registrationStatus: null, status: MemberStatus.inactive })).toBe(
      "inactive",
    );
  });

  it("says pending for a registration waiting for validation, though the API keeps status active", () => {
    expect(
      memberRowStatus({
        registrationStatus: MemberRegistrationStatus.pending,
        status: MemberStatus.active,
      }),
    ).toBe("pending");
  });

  it("says rejected for a registration that was refused, though the API keeps status active", () => {
    expect(
      memberRowStatus({
        registrationStatus: MemberRegistrationStatus.rejected,
        status: MemberStatus.active,
      }),
    ).toBe("rejected");
  });

  it("puts the registration before the participation", () => {
    expect(
      memberRowStatus({
        registrationStatus: MemberRegistrationStatus.pending,
        status: MemberStatus.inactive,
      }),
    ).toBe("pending");
    expect(
      memberRowStatus({
        registrationStatus: MemberRegistrationStatus.rejected,
        status: MemberStatus.inactive,
      }),
    ).toBe("rejected");
  });

  it("gives every status the API knows a row status", () => {
    for (const status of Object.values(MemberStatus)) {
      expect(["active", "inactive"]).toContain(
        memberRowStatus({ registrationStatus: null, status }),
      );
    }
  });
});

describe("MEMBER_ROW_STATUS_TONE", () => {
  it("gives every row status its own tone, with attention for the ones that wait or failed", () => {
    expect(MEMBER_ROW_STATUS_TONE).toEqual({
      active: "success",
      inactive: "neutral",
      pending: "warning",
      rejected: "danger",
    });
  });
});
