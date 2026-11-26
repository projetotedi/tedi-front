import {
  LessonAttendanceCard,
  PendingAttendanceAlert,
  RegisterAttendanceButton,
} from "@modules/attendance";
import type { LessonsRouteSlots } from "@modules/lessons";

export const lessonsRouteSlots: LessonsRouteSlots = {
  renderAttendance: (lesson) => <LessonAttendanceCard lesson={lesson} />,
  renderAttendanceAlert: (lesson) => <PendingAttendanceAlert lesson={lesson} />,
  renderAttendanceAction: (lesson) => <RegisterAttendanceButton lesson={lesson} />,
};
