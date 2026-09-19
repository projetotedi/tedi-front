import { describe, expect, it } from "vitest";

import { UNAUTHORIZED_EVENT as HTTP_CLIENT_UNAUTHORIZED_EVENT } from "@api/http-client";

import { UNAUTHORIZED_EVENT } from "../session-events";

describe("UNAUTHORIZED_EVENT", () => {
  it("matches the constant mirrored from @api/http-client", () => {
    expect(UNAUTHORIZED_EVENT).toBe(HTTP_CLIENT_UNAUTHORIZED_EVENT);
  });
});
