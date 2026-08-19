import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { PlayPage } from "@/components/play-page";
import "./play.css";

export const metadata: Metadata = { title: "Play" };

export default function Page() {
  return <AppShell><PlayPage /></AppShell>;
}
