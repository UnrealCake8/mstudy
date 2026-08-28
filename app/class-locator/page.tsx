import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ClassLocatorPage } from "@/components/class-locator-page";

export const metadata: Metadata = { title: "Class Locator" };

export default function Page() {
  return <AppShell><ClassLocatorPage /></AppShell>;
}
