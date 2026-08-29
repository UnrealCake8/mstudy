import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { MasterCalendarPage } from "@/components/master-calendar-page";

export const metadata: Metadata = { title: "Master Calendar" };

export default function Page() {
  return <AppShell><MasterCalendarPage /></AppShell>;
}
