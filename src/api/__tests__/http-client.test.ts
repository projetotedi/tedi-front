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

  it("returns a download as a File named by Content-Disposition, with the bytes as they came (BOM included)", async () => {
    const bytes = [0xef, 0xbb, 0xbf, ...new TextEncoder().encode("data;membro\r\n")];
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(new Uint8Array(bytes), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="hours_2026-03-01_2026-03-31.csv"',
        },
      }),
    );

    const result = await httpClient<Blob>("/hours/export?format=csv");

    expect(result).toBeInstanceOf(File);
    const file = result as File;
    expect(file.name).toBe("hours_2026-03-01_2026-03-31.csv");
    expect(file.type).toBe("text/csv; charset=utf-8");
    expect(await readBytes(file)).toEqual(bytes);
  });

  it("returns a download without Content-Type as a File with an empty type", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(new Uint8Array([97, 59, 98]), {
        status: 200,
        headers: { "Content-Disposition": 'attachment; filename="a.csv"' },
      }),
    );

    const result = await httpClient<Blob>("/export");

    expect(result).toBeInstanceOf(File);
    expect((result as File).name).toBe("a.csv");
    expect(result.type).toBe("");
  });

  it.each([
    [
      "decodes the name of filename* and prefers it to filename",
      `attachment; filename="horas.csv"; filename*=UTF-8''horas%20de%20mar%C3%A7o.csv`,
      "horas de março.csv",
    ],
    [
      "reads filename* with no plain filename",
      "attachment; filename*=utf-8'pt-BR'relat%C3%B3rio.csv",
      "relatório.csv",
    ],
    [
      "keeps a filename* that does not decode as it came",
      "attachment; filename*=UTF-8''100%.csv",
      "100%.csv",
    ],
    ["gives an empty name to an attachment without one", "attachment", ""],
  ])("%s", async (_case, disposition, name) => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("a;b", {
        status: 200,
        headers: { "Content-Type": "text/csv", "Content-Disposition": disposition },
      }),
    );

    const result = await httpClient<Blob>("/export");

    expect((result as File).name).toBe(name);
  });

  it("keeps a JSON error of a download as an ApiError", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ statusCode: 400, message: "Bad period", error: "INVALID_PERIOD" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );

    const failure = httpClient("/hours/export?format=csv");

    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({ statusCode: 400, error: "INVALID_PERIOD" });
  });

  it("keeps reading a text answer without attachment as text", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("ok", { status: 200, headers: { "Content-Type": "text/plain" } }),
    );

    await expect(httpClient("/health")).resolves.toBe("ok");
  });
});

/** The bytes of a blob, through `FileReader` (the Blob of jsdom has no `arrayBuffer`). */
function readBytes(blob: Blob): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const { result } = reader;
      if (result instanceof ArrayBuffer) resolve([...new Uint8Array(result)]);
      else reject(new Error("FileReader gave no ArrayBuffer"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}
