import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { AdminAssignmentVisibilityPage } from "@/components/admin-assignment-visibility-page";
export const metadata:Metadata={title:"Assignment Visibility"};
export default function Page(){return <AppShell><AdminAssignmentVisibilityPage/></AppShell>;}
