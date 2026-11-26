import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { Role } from "@shared/lib/role";

import { MemberAttendanceCard } from "../components/MemberAttendanceCard";
import { PendingAttendanceAlert } from "../components/PendingAttendanceAlert";
import { RegisterAttendanceButton } from "../components/RegisterAttendanceButton";
import { toAttendanceError } from "../lib/attendance-errors";
import { formatSignedAt, projectDateOf } from "../lib/attendance-format";
import { attendanceApi, buildLesson, buildMeUser, MONITOR_ID } from "./handlers";
import { renderWithProviders, server, setupAttendanceTestServer } from "./test-utils";

setupAttendanceTestServer();

describe("pending roll call", () => {
  it("says how many students are missing and scrolls to the card", async () => {
    server.use(...attendanceApi().handlers);
    const scroll = vi.fn();
    await renderWithProviders(
      <>
        <PendingAttendanceAlert lesson={buildLesson()} />
        <div
          id="lesson-attendance"
          tabIndex={-1}
          ref={(node) => {
            if (node) node.scrollIntoView = scroll;
          }}
        />
      </>,
    );
    expect(screen.getByText(/terminou às 11:00.*6 alunos/)).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Registrar chamada agora" }));
    expect(scroll).toHaveBeenCalledOnce();
  });

  it("draws nothing when the roll call is complete", async () => {
    server.use(...attendanceApi().handlers);
    const lesson = buildLesson({
      attendance: { pending: false, students: { signed: 7, total: 7 } },
    });
    await renderWithProviders(<PendingAttendanceAlert lesson={lesson} />);
    expect(screen.queryByText("Chamada pendente")).not.toBeInTheDocument();
  });
});

describe("Registrar chamada", () => {
  it("shows for a confirmed monitor", async () => {
    server.use(...attendanceApi().handlers);
    await renderWithProviders(<RegisterAttendanceButton lesson={buildLesson()} />, {
      user: buildMeUser(Role.member, MONITOR_ID),
    });
    expect(await screen.findByRole("button", { name: "Registrar chamada" })).toBeInTheDocument();
  });
});

describe("MemberAttendanceCard", () => {
  it("shows the totals and the lessons", async () => {
    server.use(
      http.get("*/members/:id/attendance", () =>
        HttpResponse.json({
          totals: { present: 2, absent: 1 },
          items: [
            {
              lesson: {
                id: "l",
                title: "Janelas",
                date: "2026-03-10",
                startTime: "09:00",
                endTime: "11:00",
              },
              status: "present",
              confirmedAt: "2026-03-10T14:00:00.000Z",
            },
          ],
        }),
      ),
    );
    await renderWithProviders(<MemberAttendanceCard memberId={MONITOR_ID} />);
    expect(await screen.findByText("2 presenças · 1 falta")).toBeInTheDocument();
    expect(screen.getByText("Janelas")).toBeInTheDocument();
  });
});

describe("helpers", () => {
  it("reads instants in the time zone of the project", () => {
    expect(projectDateOf(new Date("2026-03-11T02:30:00.000Z"))).toBe("2026-03-10");
    expect(formatSignedAt("2026-03-10T14:05:00.000Z", "2026-03-10", "pt-BR")).toBe("11:05");
    expect(formatSignedAt("2026-03-11T14:05:00.000Z", "2026-03-10", "pt-BR")).toContain(
      "11/03/2026",
    );
  });

  it("maps the errors by code", () => {
    expect(toAttendanceError({ statusCode: 409, error: "CLASS_ARCHIVED" })).toBe("classArchived");
    expect(toAttendanceError(new TypeError("x"))).toBe("network");
    expect(toAttendanceError({ statusCode: 503 })).toBe("network");
    expect(toAttendanceError({ statusCode: 500 })).toBe("unknown");
  });
});
