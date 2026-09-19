"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpenCheck, Clock3, MapPinned, Megaphone } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { Homework, subscribeCollection } from "@/lib/data";

export default function ClassesPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Homework[]>([]);

  useEffect(() => user ? subscribeCollection<Homework>(user.uid, "homework", setTasks) : undefined, [user]);

  const tools = [
    ["/timetable", "Official timetable", "Open the PDF timetable assigned to your account.", Clock3],
    ["/class-locator", "Find a classroom", "Use the school room guide when you need directions.", MapPinned],
    ["/homework", "Class assignments", "See work you have added and imported from Classroom.", BookOpenCheck],
    ["/notices", "School notices", "Read the latest announcements for students.", Megaphone],
  ] as const;

  return <AppShell><section className="page">
    <div className="page-head"><div><p className="eyebrow">Your school day</p><h1>Classes</h1><p>Your official timetable, rooms, assignments and notices in one place.</p></div></div>

    <div className="class-overview-banner">
      <div><span>Open assignments</span><strong>{tasks.filter(task => !task.completed).length}</strong></div>
      <p>Your timetable stays in its original school PDF. MPlace Study does not create a separate copy that can fall out of date.</p>
      <Link href="/timetable">Open timetable →</Link>
    </div>

    <h2 className="section-title">Class tools</h2>
    <div className="tool-grid">{tools.map(([href, title, description, Icon]) => <Link className="tool-card" href={href} key={href}><div className="icon"><Icon size={20}/></div><h2>{title}</h2><p>{description}</p></Link>)}</div>
  </section></AppShell>;
}
