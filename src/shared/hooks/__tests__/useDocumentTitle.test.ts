import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useDocumentTitle } from "../useDocumentTitle";

describe("useDocumentTitle", () => {
  it("define o título do documento", () => {
    renderHook(() => useDocumentTitle("TEDI · Pessoas"));
    expect(document.title).toBe("TEDI · Pessoas");
  });

  it("atualiza quando o título muda", () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: "Antes" },
    });
    rerender({ title: "Depois" });
    expect(document.title).toBe("Depois");
  });
});
