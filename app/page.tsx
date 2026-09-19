"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { Homework, subscribeCollection } from "@/lib/data";
import type { ClassroomAssignment, ClassroomCourse } from "@/lib/classroom";
import { assignmentVisibilityId, subscribeHiddenAssignments } from "@/lib/assignment-visibility";
import {
  SchoolTimetable,
  StudentProfile,
  subscribeSchoolTimetables,
  subscribeStudentProfile,
} from "@/lib/student-timetables";

const BASE_TIMETABLE_URL = "/files/base-timetable/base.pdf";

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
  const [classroomTasks, setClassroomTasks] = useState<ClassroomAssignment[]>([]);
  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [schoolTimetables, setSchoolTimetables] = useState<SchoolTimetable[]>([]);

  useEffect(() => {
    if (!user) return;
    const stops = [
      subscribeCollection<Homework>(user.uid, "homework", setTasks),
      subscribeCollection<ClassroomAssignment>(user.uid, "classroomAssignments", setClassroomTasks, { orderByCreatedAt: false }),
      subscribeCollection<ClassroomCourse>(user.uid, "classroomCourses", setCourses, { orderByCreatedAt: false }),
      subscribeStudentProfile(user.uid, setProfile),
    ];
    return () => stops.forEach((stop) => stop());
  }, [user]);

  useEffect(() => subscribeSchoolTimetables(setSchoolTimetables), []);
  useEffect(() => subscribeHiddenAssignments(setHidden), []);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const courseNames = useMemo(() => new Map(courses.map((course) => [course.id, course.name])), [courses]);
  const timetable = schoolTimetables.find((item) => item.id === profile?.assignedTimetableId);
  const timetableUrl = timetable?.pdfUrl || BASE_TIMETABLE_URL;
  const timetableLabel = timetable?.label || profile?.assignedTimetableLabel || "School timetable";

  const pending = useMemo(
    () => [
      ...tasks.filter((task) => !task.completed).map((task) => ({ id: `manual-${task.id}`, title: task.title, subject: task.subject, date: task.dueDate })),
      ...classroomTasks
        .filter((task) => !hidden.has(assignmentVisibilityId(task.courseId, task.id)))
        .map((task) => ({ id: `classroom-${task.courseId}-${task.id}`, title: task.title, subject: courseNames.get(task.courseId) || "Classroom", date: task.dueDate || "" })),
    ].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999")).slice(0, 5),
    [tasks, classroomTasks, hidden, courseNames],
  );

  const firstName = profile?.name?.split(" ")[0] || user?.displayName?.split(" ")[0] || "Student";

  return (
    <AppShell>
      <section className="page student-dashboard">
        <header className="student-welcome">
          <div className="welcome-copy">
            <p className="student-date">{now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
            <h1>{greeting}, {firstName}.</h1>
            <p>Your homework, timetable and study tools are ready.</p>
          </div>
          <Link className="welcome-message-link" href="/messages"><MessageCircle size={18}/> Messages</Link>
        </header>

        <div className="student-dashboard-grid home-school-grid">
          <section className="timetable-spotlight">
            <div className="student-section-head light">
              <div><span>Your school day</span><h2>{timetableLabel}</h2></div>
              <a href={timetableUrl} target="_blank" rel="noreferrer">Open PDF <ExternalLink size={15}/></a>
            </div>
            <div className="timetable-preview">
              <iframe src={timetableUrl} title={timetableLabel} />
            </div>
            <Link href="/timetable" className="timetable-manage-link">View timetable page <ArrowRight size={16}/></Link>
          </section>

          <section className="student-work-card">
            <div className="student-section-head">
              <div><span>Homework</span><h2>Coming up</h2></div>
              <Link href="/planner">See all</Link>
            </div>
            <div className="student-work-list">
              {pending.length ? pending.map((task) => (
                <Link href="/homework" className="student-work-row" key={task.id}>
                  <div className="work-subject-mark"><BookOpenCheck size={17}/></div>
                  <div><strong>{task.title}</strong><small>{task.subject || "Assignment"}</small></div>
                  <span className="work-due">{due(task.date)}</span>
                </Link>
              )) : (
                <div className="student-empty"><CheckCircle2 size={25}/><strong>Nothing due soon</strong><span>Your next assignment will appear here.</span></div>
              )}
            </div>
          </section>
        </div>

        <section className="quick-tools-section">
          <div className="student-section-head"><div><span>Shortcuts</span><h2>Get things done</h2></div></div>
          <div className="student-quick-tools">
            <Link href="/homework"><span className="quick-icon coral"><BookOpenCheck size={21}/></span><div><strong>Assignments</strong><small>Add or finish homework</small></div><ArrowRight size={18}/></Link>
            <Link href="/calendar"><span className="quick-icon blue"><CalendarDays size={21}/></span><div><strong>Calendar</strong><small>Check dates and events</small></div><ArrowRight size={18}/></Link>
            <Link href="/notes"><span className="quick-icon mint"><NotebookPen size={21}/></span><div><strong>Notes</strong><small>Pick up your revision</small></div><ArrowRight size={18}/></Link>
            <Link href="/practice-papers"><span className="quick-icon lilac"><Sparkles size={21}/></span><div><strong>Practice</strong><small>Make a practice paper</small></div><ArrowRight size={18}/></Link>
          </div>
        </section>
      </section>
    </AppShell>
  );
}
