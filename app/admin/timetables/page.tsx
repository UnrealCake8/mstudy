import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { AdminTimetableAssignmentsPage } from "@/components/admin-timetable-assignments-page";

export const metadata: Metadata = { title: "Timetable Assignments" };

export default function Page() {
  return <AppShell><AdminTimetableAssignmentsPage /></AppShell>;
}
