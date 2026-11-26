import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HourEntryOrigin } from "@api/generated/model";

import { EntryLinkNote, type EntryLinkNoteProps } from "../components/EntryLinkNote";
import { renderWithProviders, setupHoursEntriesTestServer } from "./entries-test-utils";

setupHoursEntriesTestServer();

const MANUAL: EntryLinkNoteProps["entry"] = {
  origin: HourEntryOrigin.manual,
  classId: null,
  lessonId: null,
  lessonCancelled: false,
};

describe("EntryLinkNote", () => {
  it("tags an entry whose lesson was cancelled after it was logged", async () => {
    await renderWithProviders(
      <EntryLinkNote entry={{ ...MANUAL, classId: "c", lessonId: "l", lessonCancelled: true }} />,
    );
    expect(await screen.findByText("Aula cancelada")).toBeInTheDocument();
  });

  it("says whether a logged entry is linked to a lesson or only to a class", async () => {
    const { unmount } = await renderWithProviders(
      <EntryLinkNote entry={{ ...MANUAL, classId: "c", lessonId: "l" }} />,
    );
    expect(await screen.findByText("Vinculado a uma aula")).toBeInTheDocument();
    unmount();

    await renderWithProviders(<EntryLinkNote entry={{ ...MANUAL, classId: "c" }} />);
    expect(await screen.findByText("Vinculado a uma turma")).toBeInTheDocument();
  });

  it("says nothing for an entry with no link or an hour of the attendance", async () => {
    const { unmount } = await renderWithProviders(<EntryLinkNote entry={MANUAL} />);
    expect(screen.queryByText(/Vinculado|Aula cancelada/)).not.toBeInTheDocument();
    unmount();

    await renderWithProviders(
      <EntryLinkNote
        entry={{ ...MANUAL, origin: HourEntryOrigin.attendance, classId: "c", lessonId: "l" }}
      />,
    );
    expect(screen.queryByText(/Vinculado|Aula cancelada/)).not.toBeInTheDocument();
  });
});
