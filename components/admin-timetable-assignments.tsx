"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link2, UserRoundCheck } from "lucide-react";
import { assignStudentTimetable, saveSchoolTimetable, SchoolTimetable, StudentProfile, subscribeSchoolTimetables, subscribeStudents } from "@/lib/student-timetables";

function makeId(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function AdminTimetableAssignments() {
  const [timetables, setTimetables] = useState<SchoolTimetable[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [studentUid, setStudentUid] = useState("");
  const [timetableId, setTimetableId] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => subscribeSchoolTimetables(setTimetables), []);
  useEffect(() => subscribeStudents(setStudents), []);

  const student = useMemo(() => students.find(item => item.uid === studentUid), [students, studentUid]);
  const timetable = useMemo(() => timetables.find(item => item.id === timetableId), [timetables, timetableId]);

  async function addTimetable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const label = String(data.get("label") || "").trim();
    const group = String(data.get("group") || "").trim();
    const pdfUrl = String(data.get("pdfUrl") || "").trim();
    if (!label || !pdfUrl) return;
    const item = { id: makeId(`${label}-${Date.now()}`), label, group, pdfUrl };
    await saveSchoolTimetable(item);
    setTimetableId(item.id);
    setStatus(`${label} saved.`);
    form.reset();
  }

  async function assign() {
    if (!studentUid || !timetable) return;
    await assignStudentTimetable(studentUid, timetable);
    setStatus(`${timetable.label} assigned to ${student?.name || "student"}.`);
  }

  async function clearAssignment() {
    if (!studentUid) return;
    await assignStudentTimetable(studentUid, null);
    setStatus(`Timetable assignment cleared for ${student?.name || "student"}.`);
  }

  return <section className="admin-section">
    <div className="section-row"><div><h2 className="section-title">Master Timetables</h2><p className="section-help">Create timetable PDFs, then assign any timetable directly to any registered student. A student does not need a year, class or house.</p></div></div>
    {status ? <div className="notice">{status}</div> : null}

    <form className="editor-card compact" onSubmit={addTimetable}>
      <input name="label" placeholder="Timetable name, e.g. Year 7 Main" required/>
      <input name="group" placeholder="Optional label, e.g. Year 7 or Senior School"/>
      <input name="pdfUrl" type="url" placeholder="PDF URL" required/>
      <button className="primary-button"><Link2 size={17}/> Save timetable</button>
    </form>

    <div className="admin-select-grid">
      <label>Student<select value={studentUid} onChange={e => { const uid = e.target.value; setStudentUid(uid); const profile = students.find(item => item.uid === uid); setTimetableId(profile?.assignedTimetableId || ""); }}><option value="">Choose student</option>{students.map(item => <option key={item.uid} value={item.uid}>{item.name} {item.email ? `(${item.email})` : ""}</option>)}</select></label>
      <label>Timetable<select value={timetableId} onChange={e => setTimetableId(e.target.value)}><option value="">Choose timetable</option>{timetables.map(item => <option key={item.id} value={item.id}>{item.group ? `${item.group} · ` : ""}{item.label}</option>)}</select></label>
    </div>

    {student ? <div className="notice">Current assignment: {student.assignedTimetableLabel || "None"}</div> : null}
    <div className="form-actions"><button className="primary-button" disabled={!studentUid || !timetableId} onClick={() => void assign()}><UserRoundCheck size={16}/> Assign timetable</button><button className="text-button danger" disabled={!studentUid} onClick={() => void clearAssignment()}>Clear assignment</button></div>
  </section>;
}
