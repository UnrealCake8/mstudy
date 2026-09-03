"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, CheckCircle2, Clock3, TimerReset } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { Homework, subscribeCollection, TimetableClass } from "@/lib/data";
import type { ClassroomAssignment, ClassroomCourse } from "@/lib/classroom";
import { assignmentVisibilityId, subscribeHiddenAssignments } from "@/lib/assignment-visibility";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function due(value: string) {
  if (!value) return "No due date";
  const d = new Date(`${value}T00:00:00`);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const n = Math.round((d.getTime() - t.getTime()) / 86400000);
  return n === 0 ? "Today" : n === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
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

  const todayClasses = useMemo(
    () => classes.filter((item) => item.day.toLowerCase() === today.toLowerCase()).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [classes, today],
  );

  const current = todayClasses.find((item) => item.startTime <= time && item.endTime > time);
  const next = todayClasses.find((item) => item.startTime > time);
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
      <section className="page lively-dashboard">
        <header className="lively-home-head">
          <div>
            <p className="lively-date">{now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
            <h1>Hey, {firstName} 👋</h1>
            <p>{current ? `${current.subject} is on now${current.room ? ` in Room ${current.room}` : ""}.` : next ? `${next.subject} is next at ${next.startTime}${next.room ? ` in Room ${next.room}` : ""}.` : "Check your timetable for the rest of your day."}</p>
          </div>
        </header>

        <div className="lively-summary-strip">
          <article className="summary-card summary-now">
            <div className="summary-icon"><Clock3 size={18} /></div>
            <div>
              <span>Now</span>
              <strong>{current?.subject || "No lesson shown"}</strong>
              <small>{current ? `${current.startTime}–${current.endTime}` : "Check timetable"}</small>
            </div>
          </article>
          <article className="summary-card summary-next">
            <div className="summary-icon"><TimerReset size={18} /></div>
            <div>
              <span>Next</span>
              <strong>{next?.subject || "Check timetable"}</strong>
              <small>{next ? `${next.startTime}${next.room ? ` · Room ${next.room}` : ""}` : "See your full timetable"}</small>
            </div>
          </article>
          <article className="summary-card summary-due">
            <div className="summary-icon"><BookOpenCheck size={18} /></div>
            <div>
              <span>Due soon</span>
              <strong>{pending.length}</strong>
              <small>{pending.length === 1 ? "item" : "items"}</small>
            </div>
          </article>
        </div>

        <div className="lively-main-grid">
          <section className="lively-section lively-section-planner">
            <div className="section-row lively-section-row">
              <div>
                <span className="section-kicker">Planner</span>
                <h2 className="section-title">Due soon</h2>
              </div>
              <Link href="/planner">View all</Link>
            </div>
            <div className="panel lively-panel">
              {pending.length ? pending.map((task) => (
                <div className="row lively-row" key={task.id}>
                  <div>
                    <strong>{task.title}</strong>
                    <small>{task.subject}</small>
                  </div>
                  <span className="due-chip">{due(task.date)}</span>
                </div>
              )) : (
                <div className="empty-state compact lively-empty">
                  <CheckCircle2 size={21} />
                  <strong>Nothing due soon</strong>
                  <span>You’re caught up.</span>
                </div>
              )}
            </div>
          </section>

          {todayClasses.length > 0 ? (
            <section className="lively-section lively-section-classes">
              <div className="section-row lively-section-row">
                <div>
                  <span className="section-kicker">Classes</span>
                  <h2 className="section-title">Today</h2>
                </div>
                <Link href="/timetable">Timetable</Link>
              </div>
              <div className="panel lively-panel timetable-panel">
                {todayClasses.map((item) => (
                  <div className="row lively-row timetable-row" key={item.id}>
                    <span className="time-block">{item.startTime}</span>
                    <div>
                      <strong>{item.subject}</strong>
                      <small>{item.room ? `Room ${item.room}` : "Room not set"}{item.teacher ? ` · ${item.teacher}` : ""}</small>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
