import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { TeamModePage } from "@/components/team-mode-page";
import "./team.css";

export const metadata: Metadata = { title: "Team Mode" };

export default function Page() {
  return <AppShell><TeamModePage /></AppShell>;
}
