import type { Metadata } from "next";
import { ClassroomPage } from "@/components/classroom-page";

export const metadata: Metadata = { title: "Google Classroom" };

export default function Page() {
  return <ClassroomPage />;
}
