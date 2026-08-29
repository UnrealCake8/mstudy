"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Clock3, MapPinned } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { Homework, subscribeCollection, TimetableClass } from "@/lib/data";

export default function ClassesPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<TimetableClass[]>([]);
  const [tasks, setTasks] = useState<Homework[]>([]);

  useEffect(() => {
    if (!user) return;
    const stopClasses = subscribeCollection<TimetableClass>(user.uid, "timetable", setClasses);
    const stopTasks = subscribeCollection<Homework>(user.uid, "homework", setTasks);
    return () => { stopClasses(); stopTasks(); };
  }, [user]);

  const subjects = useMemo(() => Array.from(new Set(classes.map(item => item.subject).filter(Boolean))).sort(), [classes]);

  const tools = [
    ["/timetable", "Timetable", "See your week and what lesson comes next.", Clock3],
    ["/class-locator", "Find a classroom", "Open the room locator when you need directions.", MapPinned],
  ] as const;

  return <AppShell><section className="page">
    <div className="page-head"><div><p className="eyebrow">Your school day</p><h1>Classes</h1><p>Your timetable, rooms and subjects together.</p></div></div>

    <div className="stats-grid">
      <div className="stat"><span>Subjects</span><strong>{subjects.length}</strong></div>
      <div className="stat"><span>Timetable entries</span><strong>{classes.length}</strong></div>
      <div className="stat"><span>Open assignments</span><strong>{tasks.filter(task => !task.completed).length}</strong></div>
    </div>

    <h2 className="section-title">Class tools</h2>
    <div className="tool-grid">{tools.map(([href, title, description, Icon]) => <Link className="tool-card" href={href} key={href}><div className="icon"><Icon size={20}/></div><h2>{title}</h2><p>{description}</p></Link>)}</div>

    <h2 className="section-title">Your subjects</h2>
    <div className="panel">{subjects.length === 0 ? <div className="empty-state"><strong>No subjects yet.</strong><p>Add classes to your timetable and they will appear here.</p></div> : subjects.map(subject => {
      const subjectClasses = classes.filter(item => item.subject === subject);
      const openTasks = tasks.filter(task => !task.completed && task.subject?.toLowerCase() === subject.toLowerCase()).length;
      const first = subjectClasses[0];
      return <div className="row" key={subject}><div><strong>{subject}</strong><br/><small>{first?.teacher || "Teacher not set"}{first?.room ? ` · Room ${first.room}` : ""}</small></div><span>{openTasks} assignment{openTasks === 1 ? "" : "s"} due</span></div>;
    })}</div>
  </section></AppShell>;
}
