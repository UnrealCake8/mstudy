import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { MessagesPage } from "@/components/messages-page";
import "./messages.css";
export const metadata: Metadata = { title: "Messages" };
export default function Page(){return <AppShell><MessagesPage/></AppShell>}
