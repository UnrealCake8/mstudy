"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { CalendarClock, ExternalLink, FileText, Gamepad2, GraduationCap, RefreshCw, Unplug } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DrivePickerButton } from "@/components/drive-picker-button";
import { useAuth } from "@/components/auth/auth-provider";
import { subscribeCollection } from "@/lib/data";
import { db } from "@/lib/firebase";
import { ClassroomAssignment, ClassroomCourse, ClassroomResource, ClassroomSyncSummary, disconnectClassroom, syncClassroom } from "@/lib/classroom";

function friendlyDueDate(dateValue?: string, timeValue?: string) {
  if (!dateValue) return null;
  const date = new Date(`${dateValue}T${timeValue || "12:00"}:00`);
  const dateText = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(date);
  if (!timeValue) return dateText;
  const timeText = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  return `${dateText}, ${timeText}`;
}

export function ClassroomPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<ClassroomCourse[]>([]);
  const [assignments, setAssignments] = useState<ClassroomAssignment[]>([]);
  const [resources, setResources] = useState<ClassroomResource[]>([]);
  const [connected, setConnected] = useState(false);
  const [summary, setSummary] = useState<ClassroomSyncSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const stopCourses = subscribeCollection<ClassroomCourse>(user.uid, "classroomCourses", setCourses, { orderByCreatedAt: false });
    const stopAssignments = subscribeCollection<ClassroomAssignment>(user.uid, "classroomAssignments", setAssignments, { orderByCreatedAt: false });
    const stopResources = subscribeCollection<ClassroomResource>(user.uid, "classroomResources", setResources, { orderByCreatedAt: false });
    const stopProfile = onSnapshot(doc(db, "users", user.uid), snapshot => {
      const data = snapshot.data();
      setConnected(Boolean(data?.classroomConnected));
      setSummary((data?.classroomSyncSummary as ClassroomSyncSummary | undefined) || null);
    });
    return () => { stopCourses(); stopAssignments(); stopResources(); stopProfile(); };
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
      <div><p className="eyebrow">Connected school tools</p><h1>Google Classroom</h1><p>Assignments and class resources can feed directly into Study Games.</p></div>
      <div className="form-actions">
        {connected ? <DrivePickerButton /> : null}
        <button className="primary-button" onClick={connect} disabled={busy}><RefreshCw size={17}/>{busy ? "Syncing…" : connected ? "Sync Classroom" : "Connect Classroom"}</button>
      </div>
    </div>

    {error ? <div className="notice error-notice">{error}</div> : null}
    {summary ? <div className="notice sync-summary"><strong>Synced:</strong> {summary.studentCourses + summary.teacherCourses} class{summary.studentCourses + summary.teacherCourses===1?"":"es"} · {summary.assignments} assignment{summary.assignments===1?"":"s"} · {summary.resources || 0} class material{(summary.resources || 0)===1?"":"s"}</div> : null}

    {!connected ? <div className="connect-card">
      <div className="connect-icon"><GraduationCap size={26}/></div>
      <div><h2>Connect Google Classroom</h2><p>Sync assignments, revision resources and attached Drive material into MStudy.</p></div>
      <button className="primary-button" onClick={connect} disabled={busy}>{busy ? "Connecting…" : "Connect Classroom"}</button>
    </div> : <>
      <div className="notice"><strong>Drive file access is per-file.</strong> Use <em>Authorize Classroom file</em>, choose the exact teacher file from Google Drive, and MStudy will match it to the synced assignment or class material. This keeps Drive access limited to files you explicitly choose.</div>

      <div className="section-row"><h2 className="section-title">Your classes</h2><button className="text-button" onClick={disconnect} disabled={busy}><Unplug size={15}/> Disconnect</button></div>
      {courses.length === 0 ? <div className="empty-state"><strong>No classes found</strong><span>Try syncing again or check that you connected the right Google account.</span></div> : <div className="classroom-course-grid">{courses.map(course => <article className="data-card classroom-course" key={course.id}><div><span className="pill">{course.role === "teacher" ? "Teaching" : "Class"}</span><h2>{course.name}</h2>{course.section ? <p>{course.section}</p> : null}</div>{course.alternateLink ? <a className="icon-button" href={course.alternateLink} target="_blank" rel="noreferrer" aria-label={`Open ${course.name} in Classroom`}><ExternalLink size={17}/></a> : null}</article>)}</div>}

      <div className="section-row assignment-heading"><div><h2 className="section-title">To do</h2><p className="section-help">Completed Classroom work disappears after you sync. Assignments can use explicitly authorized Drive attachments as game material.</p></div></div>
      {sorted.length === 0 ? <div className="empty-state"><strong>You’re caught up</strong><span>No unfinished Classroom assignments right now.</span></div> : <div className="classroom-assignment-list">{sorted.map(item => {
        const due = friendlyDueDate(item.dueDate,item.dueTime);
        const readable = item.materials?.filter(material => material.extractedText).length || 0;
        return <article className="classroom-assignment" key={`${item.courseId}_${item.id}`}>
          <div className="assignment-main"><span className="assignment-course">{courseNames.get(item.courseId) || "Class"}</span><h3>{item.title}</h3>{item.description ? <p>{item.description}</p> : null}{item.materials?.length ? <p className="section-help"><FileText size={14}/> {item.materials.length} attachment{item.materials.length===1?"":"s"}{readable ? ` · ${readable} ready for games` : " · authorize a file to read it"}</p> : null}</div>
          <div className="assignment-side">{due ? <div className="due-date"><CalendarClock size={16}/><span><small>Due</small>{due}</span></div> : <span className="no-due">No due date</span>}
            <div className="assignment-actions"><Link className="secondary-button assignment-open" href={`/play?course=${encodeURIComponent(item.courseId)}&assignment=${encodeURIComponent(item.id)}`}><Gamepad2 size={14}/> Play</Link>{item.alternateLink ? <a className="primary-button assignment-open" href={item.alternateLink} target="_blank" rel="noreferrer">Open <ExternalLink size={14}/></a> : null}</div>
          </div>
        </article>;
      })}</div>}

      <div className="section-row assignment-heading"><div><h2 className="section-title">Class materials</h2><p className="section-help">Revision sheets, slides, documents and resources posted by teachers outside assignments.</p></div></div>
      {resources.length === 0 ? <div className="empty-state"><strong>No class materials found</strong><span>Sync again after granting the coursework materials scope.</span></div> : <div className="classroom-assignment-list">{resources.map(item => {
        const readable = item.materials?.filter(material => material.extractedText).length || 0;
        return <article className="classroom-assignment" key={`${item.courseId}_${item.id}`}>
          <div className="assignment-main"><span className="assignment-course">{courseNames.get(item.courseId) || "Class"}</span><h3>{item.title}</h3>{item.description ? <p>{item.description}</p> : null}{item.materials?.length ? <p className="section-help"><FileText size={14}/> {item.materials.length} resource{item.materials.length===1?"":"s"}{readable ? ` · ${readable} ready for games` : " · authorize a file to read it"}</p> : null}</div>
          <div className="assignment-side"><div className="assignment-actions"><Link className="secondary-button assignment-open" href={`/play?course=${encodeURIComponent(item.courseId)}&resource=${encodeURIComponent(item.id)}`}><Gamepad2 size={14}/> Play</Link>{item.alternateLink ? <a className="primary-button assignment-open" href={item.alternateLink} target="_blank" rel="noreferrer">Open <ExternalLink size={14}/></a> : null}</div></div>
        </article>;
      })}</div>}
    </>}
  </section></AppShell>;
}
