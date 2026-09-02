import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { PracticePaperPage } from "@/components/practice-paper-page";

export const metadata: Metadata = { title: "Practice Paper Builder" };

export default function Page() {
  return (
    <AppShell>
      <PracticePaperPage />
    </AppShell>
  );
}
