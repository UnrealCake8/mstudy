"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckSquare, Clock3, GraduationCap, ListTodo } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { EventItem, Homework, subscribeCollection } from "@/lib/data";

export default function PlannerPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Homework[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    if (!user) return;
    const stopTasks = subscribeCollection<Homework>(user.uid, "homework", setTasks);
    const stopEvents = subscribeCollection<EventItem>(user.uid, "events", setEvents);
    return () => { stopTasks(); stopEvents(); };
  }, [user]);

  const dueSoon = useMemo(() => tasks
    .filter(task => !task.completed)
    .sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31"))
    .slice(0, 5), [tasks]);

  const tools = [
    ["/homework", "Assignments", "Everything you need to submit, including work you add yourself.", CheckSquare],
    ["/calendar", "Calendar", "See school dates and your schedule in one place.", CalendarDays],
    ["/events", "Exams & events", "Keep tests, exams and important dates together.", ListTodo],
    ["/classroom", "Google Classroom", "Import and review work from Classroom.", GraduationCap],
    ["/after-school", "After-school planner", "Plan homework, CCAs, dinner, revision and free time.", Clock3],
  ] as const;

  return <AppShell><section className="page">
    <div className="page-head"><div><p className="eyebrow">Plan your work</p><h1>Planner</h1><p>Assignments, deadlines and school dates in one place.</p></div></div>

    <div className="stats-grid">
      <div className="stat"><span>To do</span><strong>{tasks.filter(task => !task.completed).length}</strong></div>
      <div className="stat"><span>Completed</span><strong>{tasks.filter(task => task.completed).length}</strong></div>
      <div className="stat"><span>Saved events</span><strong>{events.length}</strong></div>
    </div>

    <h2 className="section-title">Planner tools</h2>
    <div className="tool-grid">{tools.map(([href, title, description, Icon]) => <Link className="tool-card" href={href} key={href}><div className="icon"><Icon size={20}/></div><h2>{title}</h2><p>{description}</p></Link>)}</div>

    <div className="section-row"><h2 className="section-title">Due soon</h2><Link href="/homework">View assignments</Link></div>
    <div className="panel">{dueSoon.length === 0 ? <div className="empty-state"><strong>Nothing due soon.</strong><p>Your unfinished assignments will appear here.</p></div> : dueSoon.map(task => <div className="row" key={task.id}><div><strong>{task.title}</strong><br/><small>{task.subject || "No subject"}</small></div><span>{task.dueDate ? `Due ${task.dueDate}` : "No due date"}</span></div>)}</div>
  </section></AppShell>;
}
