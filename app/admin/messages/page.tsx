import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ChatAdminPage } from "@/components/chat-admin-page";
import "../../messages/messages.css";
export const metadata: Metadata = { title: "Messaging Admin" };
export default function Page(){return <AppShell><ChatAdminPage/></AppShell>}
