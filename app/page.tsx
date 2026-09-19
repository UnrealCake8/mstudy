"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { Homework, subscribeCollection, TimetableClass } from "@/lib/data";
import type { ClassroomAssignment, ClassroomCourse } from "@/lib/classroom";
import { assignmentVisibilityId, subscribeHiddenAssignments } from "@/lib/assignment-visibility";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function due(value: string) {
  if (!value) return "No date";
  const d = new Date(`${value}T00:00:00`);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const n = Math.round((d.getTime() - t.getTime()) / 86400000);
  return n === 0 ? "Due today" : n === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function HomePage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Homework[]>([]);
  const [classes, setClasses] = useState<TimetableClass[]>([]);
  const [classroomTasks, setClassroomTasks] = useState<ClassroomAssignment[]>([]);
  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const stops = [
      subscribeCollection<Homework>(user.uid, "homework", setTasks),
      subscribeCollection<TimetableClass>(user.uid, "timetable", setClasses),
      subscribeCollection<ClassroomAssignment>(user.uid, "classroomAssignments", setClassroomTasks, { orderByCreatedAt: false }),
      subscribeCollection<ClassroomCourse>(user.uid, "classroomCourses", setCourses, { orderByCreatedAt: false }),
    ];
    return () => stops.forEach((stop) => stop());
  }, [user]);

  useEffect(() => subscribeHiddenAssignments(setHidden), []);

  const now = new Date();
  const today = dayNames[now.getDay()];
  const time = now.toTimeString().slice(0, 5);
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const todayClasses = useMemo(
    () => classes.filter((item) => item.day.toLowerCase() === today.toLowerCase()).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [classes, today],
  );

  const current = todayClasses.find((item) => item.startTime <= time && item.endTime > time);
  const next = todayClasses.find((item) => item.startTime > time);
  const featuredLesson = current || next;
  const courseNames = useMemo(() => new Map(courses.map((course) => [course.id, course.name])), [courses]);

  const pending = useMemo(
    () => [
      ...tasks.filter((task) => !task.completed).map((task) => ({ id: `manual-${task.id}`, title: task.title, subject: task.subject, date: task.dueDate })),
      ...classroomTasks
        .filter((task) => !hidden.has(assignmentVisibilityId(task.courseId, task.id)))
        .map((task) => ({ id: `classroom-${task.courseId}-${task.id}`, title: task.title, subject: courseNames.get(task.courseId) || "Classroom", date: task.dueDate || "" })),
    ].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999")).slice(0, 4),
    [tasks, classroomTasks, hidden, courseNames],
  );

  const firstName = user?.displayName?.split(" ")[0] || "Student";

  return (
    <AppShell>
      <section className="page student-dashboard">
        <header className="student-welcome">
          <div className="welcome-copy">
            <p className="student-date">{now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
            <h1>{greeting}, {firstName}.</h1>
            <p>{current ? "You’re in the middle of your school day." : next ? "Here’s what is coming up next." : "You’re all caught up with today’s timetable."}</p>
          </div>
          <div className="day-progress" aria-label={`${todayClasses.length} lessons today`}>
            <span>{todayClasses.length}</span>
            <small>{todayClasses.length === 1 ? "lesson today" : "lessons today"}</small>
          </div>
        </header>

        <div className="student-dashboard-grid">
          <section className="lesson-spotlight">
            <div className="spotlight-topline">
              <span className={current ? "live-dot" : "next-dot"} />
              <span>{current ? "Happening now" : "Up next"}</span>
            </div>
            {featuredLesson ? (
              <>
                <h2>{featuredLesson.subject}</h2>
                <div className="lesson-details">
                  <span><Clock3 size={17} />{featuredLesson.startTime}–{featuredLesson.endTime}</span>
                  <span><MapPin size={17} />{featuredLesson.room ? `Room ${featuredLesson.room}` : "Room not set"}</span>
                </div>
                {featuredLesson.teacher ? <p className="lesson-teacher">{featuredLesson.teacher}</p> : null}
                <Link href="/timetable" className="spotlight-link">Open timetable <ArrowRight size={17} /></Link>
              </>
            ) : (
              <div className="no-lesson">
                <CheckCircle2 size={30} />
                <h2>No more lessons shown</h2>
                <p>Take a look at your timetable if you want to plan ahead.</p>
                <Link href="/timetable" className="spotlight-link">Open timetable <ArrowRight size={17} /></Link>
              </div>
            )}
          </section>

          <section className="student-work-card">
            <div className="student-section-head">
              <div>
                <span>Homework</span>
                <h2>Coming up</h2>
              </div>
              <Link href="/planner">See all</Link>
            </div>
            <div className="student-work-list">
              {pending.length ? pending.map((task) => (
                <Link href="/homework" className="student-work-row" key={task.id}>
                  <div className="work-subject-mark"><BookOpenCheck size={17} /></div>
                  <div>
                    <strong>{task.title}</strong>
                    <small>{task.subject || "Assignment"}</small>
                  </div>
                  <span className="work-due">{due(task.date)}</span>
                </Link>
              )) : (
                <div className="student-empty">
                  <CheckCircle2 size={25} />
                  <strong>Nothing due soon</strong>
                  <span>Your next assignment will appear here.</span>
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="today-schedule-section">
          <div className="student-section-head">
            <div><span>Your day</span><h2>Today’s lessons</h2></div>
            <Link href="/timetable">Full week</Link>
          </div>
          {todayClasses.length ? (
            <div className="lesson-strip">
              {todayClasses.map((item) => {
                const isCurrent = item.startTime <= time && item.endTime > time;
                return (
                  <article className={isCurrent ? "lesson-chip current" : "lesson-chip"} key={item.id}>
                    <span className="lesson-time">{item.startTime}</span>
                    <strong>{item.subject}</strong>
                    <small>{item.room ? `Room ${item.room}` : "Room not set"}</small>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="schedule-empty">No lessons have been added for {today} yet.</div>
          )}
        </section>

        <section className="quick-tools-section">
          <div className="student-section-head"><div><span>Shortcuts</span><h2>Get things done</h2></div></div>
          <div className="student-quick-tools">
            <Link href="/homework"><span className="quick-icon coral"><BookOpenCheck size={21} /></span><div><strong>Assignments</strong><small>Add or finish homework</small></div><ArrowRight size={18} /></Link>
            <Link href="/calendar"><span className="quick-icon blue"><CalendarDays size={21} /></span><div><strong>Calendar</strong><small>Check dates and events</small></div><ArrowRight size={18} /></Link>
            <Link href="/notes"><span className="quick-icon mint"><NotebookPen size={21} /></span><div><strong>Notes</strong><small>Pick up your revision</small></div><ArrowRight size={18} /></Link>
            <Link href="/practice-papers"><span className="quick-icon lilac"><Sparkles size={21} /></span><div><strong>Practice</strong><small>Make a practice paper</small></div><ArrowRight size={18} /></Link>
          </div>
        </section>
      </section>
    </AppShell>
  );
}
