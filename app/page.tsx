"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Megaphone,
  NotebookPen,
  Plus,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import {
  CcaActivity,
  Homework,
  subscribeCollection,
  TimetableClass,
} from "@/lib/data";
import type {
  ClassroomAnnouncement,
  ClassroomAssignment,
  ClassroomCourse,
} from "@/lib/classroom";
import {
  assignmentVisibilityId,
  subscribeHiddenAssignments,
} from "@/lib/assignment-visibility";
const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ],
  checks = [
    "Device charged",
    "Bag packed",
    "Water bottle ready",
    "Correct uniform or PE kit",
  ];
function due(value: string) {
  if (!value) return "No due date";
  const d = new Date(`${value}T00:00:00`),
    t = new Date();
  t.setHours(0, 0, 0, 0);
  const n = Math.round((d.getTime() - t.getTime()) / 86400000);
  return n === 0
    ? "Today"
    : n === 1
      ? "Tomorrow"
      : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
export default function HomePage() {
  const { user } = useAuth(),
    [tasks, setTasks] = useState<Homework[]>([]),
    [classes, setClasses] = useState<TimetableClass[]>([]),
    [ccas, setCcas] = useState<CcaActivity[]>([]),
    [announcements, setAnnouncements] = useState<ClassroomAnnouncement[]>([]),
    [classroomTasks, setClassroomTasks] = useState<ClassroomAssignment[]>([]),
    [courses, setCourses] = useState<ClassroomCourse[]>([]),
    [hidden, setHidden] = useState<Set<string>>(new Set()),
    [ready, setReady] = useState<string[]>([]);
  useEffect(() => {
    if (!user) return;
    const stops = [
      subscribeCollection<Homework>(user.uid, "homework", setTasks),
      subscribeCollection<TimetableClass>(user.uid, "timetable", setClasses),
      subscribeCollection<CcaActivity>(user.uid, "ccaActivities", setCcas),
      subscribeCollection<ClassroomAnnouncement>(
        user.uid,
        "classroomAnnouncements",
        setAnnouncements,
        { orderByCreatedAt: false },
      ),
      subscribeCollection<ClassroomAssignment>(
        user.uid,
        "classroomAssignments",
        setClassroomTasks,
        { orderByCreatedAt: false },
      ),
      subscribeCollection<ClassroomCourse>(
        user.uid,
        "classroomCourses",
        setCourses,
        { orderByCreatedAt: false },
      ),
    ];
    return () => stops.forEach((s) => s());
  }, [user]);
  useEffect(() => subscribeHiddenAssignments(setHidden), []);
  const now = new Date(),
    today = dayNames[now.getDay()],
    time = now.toTimeString().slice(0, 5),
    dateKey = now.toISOString().slice(0, 10);
  useEffect(() => {
    try {
      setReady(
        JSON.parse(localStorage.getItem(`mstudy-ready-${dateKey}`) || "[]"),
      );
    } catch {}
  }, [dateKey]);
  function toggle(label: string) {
    const next = ready.includes(label)
      ? ready.filter((x) => x !== label)
      : [...ready, label];
    setReady(next);
    localStorage.setItem(`mstudy-ready-${dateKey}`, JSON.stringify(next));
  }
  const todayClasses = useMemo(
      () =>
        classes
          .filter((i) => i.day.toLowerCase() === today.toLowerCase())
          .sort((a, b) => a.startTime.localeCompare(b.startTime)),
      [classes, today],
    ),
    current = todayClasses.find((i) => i.startTime <= time && i.endTime > time),
    next = todayClasses.find((i) => i.startTime > time),
    todayCcas = ccas
      .filter((i) => i.day === today)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    courseNames = useMemo(
      () => new Map(courses.map((c) => [c.id, c.name])),
      [courses],
    ),
    pending = useMemo(
      () =>
        [
          ...tasks
            .filter((t) => !t.completed)
            .map((t) => ({
              id: `manual-${t.id}`,
              title: t.title,
              subject: t.subject,
              date: t.dueDate,
            })),
          ...classroomTasks
            .filter(
              (t) => !hidden.has(assignmentVisibilityId(t.courseId, t.id)),
            )
            .map((t) => ({
              id: `classroom-${t.courseId}-${t.id}`,
              title: t.title,
              subject: courseNames.get(t.courseId) || "Classroom",
              date: t.dueDate || "",
            })),
        ]
          .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"))
          .slice(0, 5),
      [tasks, classroomTasks, hidden, courseNames],
    ),
    notices = useMemo(
      () =>
        announcements
          .filter((n) =>
            /secondary|house|gecko|falcon|fox|lynx|stingray/i.test(
              courseNames.get(n.courseId) || "",
            ),
          )
          .sort((a, b) =>
            (b.updateTime || "").localeCompare(a.updateTime || ""),
          )
          .slice(0, 3),
      [announcements, courseNames],
    );
  const actions: Array<[string, string, typeof Plus]> = [
    ["/homework", "Add homework", Plus],
    ["/after-school", "Plan after school", CalendarDays],
    ["/cca", "CCA Hub", Sparkles],
    ["/school-guide", "School guide", BookOpen],
    ["/notes", "New note", NotebookPen],
  ];
  return (
    <AppShell>
      <section className="page">
        <div className="dashboard-hero">
          <p className="eyebrow light">
            {now.toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1>Hey, {user?.displayName?.split(" ")[0] || "Student"}.</h1>
          <p>
            {current
              ? `${current.subject} is happening now in ${current.room ? `Room ${current.room}` : "your scheduled classroom"}.`
              : next
                ? `Next: ${next.subject} at ${next.startTime}${next.room ? ` in Room ${next.room}` : ""}.`
                : "Here’s what you need to know today."}
          </p>
        </div>
        <div className="today-focus-grid">
          <article className="focus-card">
            <span>Current lesson</span>
            <strong>{current?.subject || "No lesson now"}</strong>
            <small>
              {current
                ? `${current.startTime}–${current.endTime}${current.room ? ` · Room ${current.room}` : ""}`
                : "Check today’s timetable below"}
            </small>
          </article>
          <article className="focus-card">
            <span>Next classroom</span>
            <strong>
              {next?.room
                ? `Room ${next.room}`
                : next
                  ? "Room not set"
                  : "No more classes"}
            </strong>
            <small>
              {next
                ? `${next.subject} · ${next.startTime}`
                : "You’re finished for today"}
            </small>
          </article>
          <article className="focus-card">
            <span>CCA today</span>
            <strong>{todayCcas[0]?.name || "None added"}</strong>
            <small>
              {todayCcas[0]
                ? `${todayCcas[0].startTime}–${todayCcas[0].endTime}`
                : "Add activities in CCA Hub"}
            </small>
          </article>
        </div>
        <div className="dashboard-two-col">
          <section>
            <div className="section-row">
              <h2 className="section-title">Homework due</h2>
              <Link href="/planner">Planner</Link>
            </div>
            <div className="panel">
              {pending.length ? (
                pending.map((t) => (
                  <div className="row" key={t.id}>
                    <div>
                      <strong>{t.title}</strong>
                      <br />
                      <small>{t.subject}</small>
                    </div>
                    <span>{due(t.date)}</span>
                  </div>
                ))
              ) : (
                <div className="empty-state compact">
                  <CheckCircle2 />
                  <strong>You’re caught up</strong>
                </div>
              )}
            </div>
          </section>
          <section>
            <div className="section-row">
              <h2 className="section-title">Daily readiness</h2>
              <span className="section-count">
                {ready.length}/{checks.length}
              </span>
            </div>
            <div className="readiness-card">
              {checks.map((item) => (
                <button
                  className={
                    ready.includes(item)
                      ? "readiness-item done"
                      : "readiness-item"
                  }
                  key={item}
                  onClick={() => toggle(item)}
                >
                  <span>
                    <Check size={15} />
                  </span>
                  {item}
                </button>
              ))}
            </div>
          </section>
        </div>
        <div className="section-row">
          <h2 className="section-title">School notices</h2>
          <Link href="/notices">All notices</Link>
        </div>
        <div className="notice-feed">
          {notices.length ? (
            notices.map((n) => (
              <article className="notice-card" key={`${n.courseId}_${n.id}`}>
                <div>
                  <span className="pill">
                    {courseNames.get(n.courseId) || "School"}
                  </span>
                  <p>{n.text}</p>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state compact">
              <Megaphone />
              <strong>No Secondary or House notices synced</strong>
              <span>Sync Google Classroom to check for announcements.</span>
            </div>
          )}
        </div>
        <div className="section-row">
          <h2 className="section-title">Today’s timetable</h2>
          <Link href="/timetable">Full timetable</Link>
        </div>
        <div className="panel">
          {todayClasses.length ? (
            todayClasses.map((i) => (
              <div className="row" key={i.id}>
                <div>
                  <strong>{i.subject}</strong>
                  <br />
                  <small>
                    {i.room ? `Room ${i.room}` : "Room not set"}
                    {i.teacher ? ` · ${i.teacher}` : ""}
                  </small>
                </div>
                <span>
                  {i.startTime}–{i.endTime}
                </span>
              </div>
            ))
          ) : (
            <div className="empty-state compact">
              <Clock3 />
              <strong>No personal classes added for today</strong>
            </div>
          )}
        </div>
        <h2 className="section-title">Quick actions</h2>
        <div className="tool-grid">
          {actions.map(([href, title, Icon]) => (
            <Link className="tool-card" href={href} key={href}>
              <div className="icon">
                <Icon size={20} />
              </div>
              <h2>{title}</h2>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
