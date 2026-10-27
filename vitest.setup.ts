import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  // O estado da sidebar (grupos abertos) vive no sessionStorage e não pode vazar entre testes.
  sessionStorage.clear();
});
