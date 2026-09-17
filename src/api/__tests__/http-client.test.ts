import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, UNAUTHORIZED_EVENT, httpClient } from "../http-client";

describe("httpClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubEnv("VITE_API_URL", "/api");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("prefixes VITE_API_URL and sends credentials include with no Authorization header", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await httpClient("/auth/me");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/me");
    expect((init as { credentials: string }).credentials).toBe("include");
    const headers = new Headers(init.headers);
    expect(headers.has("Authorization")).toBe(false);
  });

  it("dispatches tedi:unauthorized and throws ApiError on 401", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ statusCode: 401, message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);

    await expect(httpClient("/auth/me")).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledOnce();

    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  });

  it("throws ApiError with statusCode and message from body on 4xx", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ statusCode: 400, message: "Bad", error: "BAD_REQUEST" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    let caught: unknown;
    try {
      await httpClient("/some/endpoint");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);
    const err = caught as ApiError;
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Bad");
    expect(err.error).toBe("BAD_REQUEST");
  });
});
