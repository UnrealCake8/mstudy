"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link2, Search, UserRoundCheck } from "lucide-react";
import { assignStudentTimetable, findStudentByEmail, saveSchoolTimetable, SchoolTimetable, StudentProfile, subscribeSchoolTimetables } from "@/lib/student-timetables";

function makeId(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function AdminTimetableAssignments() {
  const [timetables, setTimetables] = useState<SchoolTimetable[]>([]);
  const [studentEmail, setStudentEmail] = useState("");
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [timetableId, setTimetableId] = useState("");
  const [status, setStatus] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => subscribeSchoolTimetables(setTimetables), []);

  const normalizedEmail = studentEmail.trim().toLowerCase();
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

  async function lookupStudent() {
    if (!normalizedEmail) {
      setStudent(null);
      setStatus("Enter the student's email address.");
      return null;
    }
    setLookingUp(true);
    setStatus("Looking up student...");
    try {
      const found = await findStudentByEmail(studentEmail);
      setStudent(found);
      if (!found) {
        setStatus(`No registered student was found with ${studentEmail.trim()}.`);
        return null;
      }
      setTimetableId(found.assignedTimetableId || timetableId);
      setStatus(`Found ${found.name || found.email}.`);
      return found;
    } catch (error) {
      console.error("Student email lookup failed", error);
      setStudent(null);
      setStatus("Student lookup was blocked by Firestore. Publish the latest Firestore rules, then try again.");
      return null;
    } finally {
      setLookingUp(false);
    }
  }

  async function assign() {
    if (!timetable) {
      setStatus("Choose a timetable first.");
      return;
    }
    const target = student?.email?.trim().toLowerCase() === normalizedEmail ? student : await lookupStudent();
    if (!target) return;
    try {
      await assignStudentTimetable(target.uid, timetable);
      setStudent({ ...target, assignedTimetableId: timetable.id, assignedTimetableLabel: timetable.label });
      setStatus(`${timetable.label} assigned to ${target.name || target.email}.`);
    } catch (error) {
      console.error("Timetable assignment failed", error);
      setStatus("Assignment was blocked by Firestore. Publish the latest Firestore rules, then try again.");
    }
  }

  async function clearAssignment() {
    const target = student?.email?.trim().toLowerCase() === normalizedEmail ? student : await lookupStudent();
    if (!target) return;
    try {
      await assignStudentTimetable(target.uid, null);
      setStudent({ ...target, assignedTimetableId: "", assignedTimetableLabel: "" });
      setStatus(`Timetable assignment cleared for ${target.name || target.email}.`);
    } catch (error) {
      console.error("Timetable assignment clear failed", error);
      setStatus("Clearing the assignment was blocked by Firestore. Publish the latest Firestore rules, then try again.");
    }
  }

  return <section className="admin-section">
    <div className="section-row"><div><h2 className="section-title">Master Timetables</h2><p className="section-help">Create timetable PDFs, then assign any timetable directly to a registered student by entering their email address.</p></div></div>
    {status ? <div className="notice">{status}</div> : null}

    <form className="editor-card compact" onSubmit={addTimetable}>
      <input name="label" placeholder="Timetable name, e.g. Year 7 Main" required/>
      <input name="group" placeholder="Optional label, e.g. Year 7 or Senior School"/>
      <input name="pdfUrl" type="url" placeholder="PDF URL" required/>
      <button className="primary-button"><Link2 size={17}/> Save timetable</button>
    </form>

    <div className="admin-select-grid">
      <label>Student email<input type="email" value={studentEmail} onChange={e => { setStudentEmail(e.target.value); setStudent(null); }} placeholder="student@example.com" autoComplete="off"/></label>
      <label>Timetable<select value={timetableId} onChange={e => setTimetableId(e.target.value)}><option value="">Choose timetable</option>{timetables.map(item => <option key={item.id} value={item.id}>{item.group ? `${item.group} · ` : ""}{item.label}</option>)}</select></label>
    </div>

    <div className="form-actions"><button className="text-button" disabled={!normalizedEmail || lookingUp} onClick={() => void lookupStudent()}><Search size={16}/> {lookingUp ? "Looking up..." : "Find student"}</button></div>
    {student ? <div className="notice"><strong>{student.name || "Student"}</strong>{student.email ? ` · ${student.email}` : ""}<br/>Current assignment: {student.assignedTimetableLabel || "None"}</div> : null}
    <div className="form-actions"><button className="primary-button" disabled={!normalizedEmail || !timetableId || lookingUp} onClick={() => void assign()}><UserRoundCheck size={16}/> Assign timetable</button><button className="text-button danger" disabled={!normalizedEmail || lookingUp} onClick={() => void clearAssignment()}>Clear assignment</button></div>
  </section>;
}
