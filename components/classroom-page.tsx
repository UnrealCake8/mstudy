"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { ExternalLink, GraduationCap, RefreshCw, Unplug } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { subscribeCollection } from "@/lib/data";
import { db } from "@/lib/firebase";
import { ClassroomAssignment, ClassroomCourse, ClassroomSyncSummary, disconnectClassroom, syncClassroom } from "@/lib/classroom";

export function ClassroomPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [assignments, setAssignments] = useState<ClassroomAssignment[]>([]);
  const [connected, setConnected] = useState(false);
  const [summary, setSummary] = useState<ClassroomSyncSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // Classroom documents come from Google and do not have MStudy's createdAt field.
    // Reading them with orderBy("createdAt") causes Firestore to exclude every document.
    const stopCourses = subscribeCollection<ClassroomCourse>(user.uid, "classroomCourses", setCourses, { orderByCreatedAt: false });
    const stopAssignments = subscribeCollection<ClassroomAssignment>(user.uid, "classroomAssignments", setAssignments, { orderByCreatedAt: false });
    const stopProfile = onSnapshot(doc(db, "users", user.uid), snapshot => {
      const data = snapshot.data();
      setConnected(Boolean(data?.classroomConnected));
      setSummary((data?.classroomSyncSummary as ClassroomSyncSummary | undefined) || null);
    });
    return () => { stopCourses(); stopAssignments(); stopProfile(); };
  }, [user]);

  const courseNames = useMemo(() => new Map(courses.map(course => [course.id, course.name])), [courses]);
  const sorted = useMemo(() => [...assignments].sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  }), [assignments]);

  async function connect() {
    if (!user) return;
    setBusy(true); setError(null);
    try {
      const result = await syncClassroom(user);
      setSummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect Google Classroom.");
    } finally { setBusy(false); }
  }

  async function disconnect() {
    if (!user) return;
    setBusy(true); setError(null);
    try { await disconnectClassroom(user); setSummary(null); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not disconnect Google Classroom."); }
    finally { setBusy(false); }
  }

  return <AppShell><section className="page">
    <div className="page-head">
      <div><p className="eyebrow">Connected school tools</p><h1>Google Classroom</h1><p>Your classes and published assignments, in MStudy.</p></div>
      <button className="primary-button" onClick={connect} disabled={busy}><RefreshCw size={17}/>{busy ? "Connecting…" : connected ? "Sync Classroom" : "Connect Classroom"}</button>
    </div>

    {error ? <div className="notice error-notice">{error}</div> : null}
    {summary ? <div className="notice"><strong>Last sync:</strong> {summary.googleEmail} · {summary.studentCourses} student classes · {summary.teacherCourses} teacher classes · {summary.assignments} assignments</div> : null}

    {!connected ? <div className="connect-card">
      <div className="connect-icon"><GraduationCap size={26}/></div>
      <div><h2>Bring your classes into MStudy</h2><p>Connect your Google account to import the Classroom courses and assignments you already have access to. MStudy only requests read-only Classroom permissions.</p></div>
      <button className="primary-button" onClick={connect} disabled={busy}>{busy ? "Connecting…" : "Connect Google Classroom"}</button>
    </div> : <>
      <div className="section-row"><h2 className="section-title">Classes</h2><button className="text-button" onClick={disconnect} disabled={busy}><Unplug size={15}/> Disconnect</button></div>
      {courses.length === 0 ? <div className="empty-state"><strong>No Classroom courses returned by Google</strong><span>Press Sync Classroom and check the sync summary above.</span></div> : <div className="classroom-course-grid">{courses.map(course => <article className="data-card classroom-course" key={course.id}><div><span className="pill">{course.role === "teacher" ? "Teaching" : course.role === "student" ? "Student" : "Class"}</span><h2>{course.name}</h2>{course.section ? <p>{course.section}</p> : null}{course.courseState ? <p>{course.courseState}</p> : null}</div>{course.alternateLink ? <a className="icon-button" href={course.alternateLink} target="_blank" rel="noreferrer" aria-label={`Open ${course.name} in Classroom`}><ExternalLink size={17}/></a> : null}</article>)}</div>}

      <h2 className="section-title">Assignments</h2>
      {sorted.length === 0 ? <div className="empty-state"><strong>No published assignments returned by Google</strong></div> : <div className="task-list">{sorted.map(item => <article className="task-row classroom-task" key={`${item.courseId}_${item.id}`}><div className="task-copy"><strong>{item.title}</strong><span>{courseNames.get(item.courseId) || "Class"}{item.dueDate ? ` · Due ${item.dueDate}${item.dueTime ? ` ${item.dueTime}` : ""}` : ""}</span></div>{item.alternateLink ? <a className="secondary-button compact-button" href={item.alternateLink} target="_blank" rel="noreferrer">Open <ExternalLink size={14}/></a> : null}</article>)}</div>}
    </>}
  </section></AppShell>;
}
