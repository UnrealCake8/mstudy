"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, Gamepad2, NotebookPen, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { Homework, subscribeCollection, TimetableClass } from "@/lib/data";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function friendlyDueDate(value: string) {
  if (!value) return "No due date";
  const due = new Date(`${value}T00:00:00`);
  if (Number.isNaN(due.getTime())) return value;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return due.toLocaleDateString(undefined, { weekday: "long" });
  return due.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function HomePage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Homework[]>([]);
  const [classes, setClasses] = useState<TimetableClass[]>([]);

  useEffect(() => {
    if (!user) return;
    const stopHomework = subscribeCollection<Homework>(user.uid, "homework", setTasks);
    const stopTimetable = subscribeCollection<TimetableClass>(user.uid, "timetable", setClasses);
    return () => { stopHomework(); stopTimetable(); };
  }, [user]);

  const now = new Date();
  const todayName = dayNames[now.getDay()];
  const currentTime = now.toTimeString().slice(0, 5);
  const dateLabel = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  const pending = useMemo(() => tasks
    .filter(task => !task.completed)
    .sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31"))
    .slice(0, 4), [tasks]);

  const todayClasses = useMemo(() => classes
    .filter(item => item.day.toLowerCase() === todayName.toLowerCase())
    .sort((a, b) => a.startTime.localeCompare(b.startTime)), [classes, todayName]);

  const nextClass = todayClasses.find(item => item.endTime >= currentTime);
  const completedCount = tasks.filter(task => task.completed).length;

  const quickActions = [
    ["/homework", "Add assignment", Plus],
    ["/notes", "New note", NotebookPen],
    ["/planner", "Open planner", CalendarDays],
    ["/study", "Start studying", Gamepad2],
  ] as const;

  return <AppShell><section className="page">
    <div className="dashboard-hero">
      <p className="eyebrow light">{dateLabel}</p>
      <h1>Hey, {user?.displayName?.split(" ")[0] || "Student"}.</h1>
      <p>{nextClass ? `Next up: ${nextClass.subject} at ${nextClass.startTime}.` : todayClasses.length ? "You’ve finished your classes for today." : "Here’s what you need to know today."}</p>
    </div>

    <div className="stats-grid">
      <div className="stat"><span>Assignments to do</span><strong>{tasks.filter(task => !task.completed).length}</strong></div>
      <div className="stat"><span>Classes today</span><strong>{todayClasses.length}</strong></div>
      <div className="stat"><span>Completed</span><strong>{completedCount}</strong></div>
    </div>

    {nextClass && <>
      <div className="section-row"><h2 className="section-title">Next class</h2><Link href="/classes">Open classes</Link></div>
      <div className="panel"><div className="row"><div><strong>{nextClass.subject}</strong><br/><small>{nextClass.room ? `Room ${nextClass.room}` : "Room not set"}{nextClass.teacher ? ` · ${nextClass.teacher}` : ""}</small></div><span>{nextClass.startTime}–{nextClass.endTime}</span></div></div>
    </>}

    <div className="section-row"><h2 className="section-title">Due soon</h2><Link href="/planner">Open planner</Link></div>
    <div className="panel">
      {pending.length === 0 ? <div className="empty-state"><CheckCircle2 size={22}/><strong>You’re all caught up.</strong><p>No unfinished assignments are waiting for you.</p></div> : pending.map(task => <div className="row" key={task.id}><div><strong>{task.title}</strong><br/><small>{task.subject}</small></div><span>Due {friendlyDueDate(task.dueDate)}</span></div>)}
    </div>

    <div className="section-row"><h2 className="section-title">Today’s classes</h2><Link href="/classes">View classes</Link></div>
    <div className="panel">
      {todayClasses.length === 0 ? <div className="empty-state"><Clock3 size={22}/><strong>No classes on your timetable today.</strong></div> : todayClasses.map(item => <div className="row" key={item.id}><div><strong>{item.subject}</strong><br/><small>{item.room ? `Room ${item.room}` : "Room not set"}</small></div><span>{item.startTime}–{item.endTime}</span></div>)}
    </div>

    <h2 className="section-title">Quick actions</h2>
    <div className="tool-grid">{quickActions.map(([href, title, Icon]) => <Link className="tool-card" href={href} key={href}><div className="icon"><Icon size={20}/></div><h2>{title}</h2></Link>)}</div>
  </section></AppShell>;
}
