import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { AdminPage } from "@/components/admin-page";

export const metadata: Metadata = { title: "Admin" };

export default function Page() {
  return <AppShell><AdminPage /></AppShell>;
}
