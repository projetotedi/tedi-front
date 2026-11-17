import { describe, expect, it } from "vitest";

import { rejectEntryFormSchema, toRejectBody } from "../schemas/reject-entry.schema";

function reasonError(reason: string): string | undefined {
  const result = rejectEntryFormSchema.safeParse({ reason });
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe("reject entry schema", () => {
  it("asks for the reason when it is empty or only spaces", () => {
    expect(reasonError("")).toBe("reasonRequired");
    expect(reasonError("   ")).toBe("reasonRequired");
  });

  it("refuses a reason over 500 characters", () => {
    expect(reasonError("a".repeat(501))).toBe("tooLong");
    expect(reasonError("a".repeat(500))).toBeUndefined();
  });

  it("toRejectBody sends the trimmed reason", () => {
    const values = rejectEntryFormSchema.parse({ reason: "  Sem comprovação da feira.  " });

    expect(toRejectBody(values)).toEqual({ reason: "Sem comprovação da feira." });
  });
});
