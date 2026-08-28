"use client";

import { FormEvent, useEffect, useState } from "react";
import { Building2, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { addItem, deleteItem, subscribeCollection, TimetableClass, updateItem } from "@/lib/data";
import { DEFAULT_SES, roomLocation } from "@/lib/school-data";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const BASE_TIMETABLE_URL = "https://assets.mplace.cc/base-timetable/base.pdf";

export function TimetablePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<TimetableClass[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TimetableClass | null>(null);

  useEffect(() => user ? subscribeCollection<TimetableClass>(user.uid, "timetable", setItems) : undefined, [user]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const f = new FormData(e.currentTarget);
    const value = Object.fromEntries(["subject", "day", "startTime", "endTime", "room", "teacher"].map(k => [k, String(f.get(k) || "")]));
    if (editing) await updateItem(user.uid, "timetable", editing.id, value);
    else await addItem(user.uid, "timetable", value);
    e.currentTarget.reset();
    setEditing(null);
    setOpen(false);
  }

  function edit(item: TimetableClass) {
    setEditing(item);
    setOpen(true);
  }

  function roomText(room: string) {
    if (!room) return "";
    const found = roomLocation(room, DEFAULT_SES);
    return found && found.building !== "Unknown building" ? `${found.code} · ${found.building}` : room;
  }

  return <section className="page">
    <div className="page-head">
      <div><p className="eyebrow">Your week</p><h1>Timetable</h1><p>View the shared school timetable and keep your personal timetable underneath.</p></div>
      <button className="primary-button" onClick={() => { setEditing(null); setOpen(v => !v); }}><Plus size={17}/> Add class</button>
    </div>

    <section className="school-week">
      <div className="section-row">
        <div><h2 className="section-title">School timetable</h2><p className="section-help">This is the shared base timetable shown to everyone.</p></div>
        <a className="text-button" href={BASE_TIMETABLE_URL} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Open PDF</a>
      </div>
      <div style={{ width: "100%", minHeight: 720, borderRadius: 18, overflow: "hidden", border: "1px solid var(--line)", background: "var(--surface)" }}>
        <iframe
          src={BASE_TIMETABLE_URL}
          title="Shared school timetable"
          style={{ width: "100%", height: "78vh", minHeight: 720, border: 0, display: "block" }}
        />
      </div>
    </section>

    {open ? <form className="editor-card compact" onSubmit={submit}>
      <input name="subject" placeholder="Subject" defaultValue={editing?.subject || ""} required/>
      <select name="day" defaultValue={editing?.day || "Monday"} required>{days.map(d => <option key={d}>{d}</option>)}</select>
      <input name="startTime" type="time" defaultValue={editing?.startTime || ""} required/>
      <input name="endTime" type="time" defaultValue={editing?.endTime || ""} required/>
      <input name="room" placeholder="Room" defaultValue={editing?.room || ""}/>
      <input name="teacher" placeholder="Teacher" defaultValue={editing?.teacher || ""}/>
      <button className="primary-button">{editing ? "Save changes" : "Save class"}</button>
    </form> : null}

    <section className="school-week">
      <div className="section-row"><div><h2 className="section-title">My personal timetable</h2><p className="section-help">These classes belong only to you and can be edited or deleted at any time.</p></div></div>
      <div className="week-grid">{days.map(day => <section className="day-column" key={day}><h2>{day}</h2>{items.filter(i => i.day === day).sort((a,b) => a.startTime.localeCompare(b.startTime)).map(i => <article className="class-card" key={i.id}><div><strong>{i.subject}</strong><span>{i.startTime}–{i.endTime}</span><small>{i.room ? <span className="school-room-meta"><Building2 size={12}/> {roomText(i.room)}</span> : null}{i.teacher ? <span>{i.teacher}</span> : null}</small></div><div><button className="icon-button" aria-label={`Edit ${i.subject}`} onClick={() => edit(i)}><Pencil size={15}/></button><button className="icon-button danger" aria-label={`Delete ${i.subject}`} onClick={() => user && deleteItem(user.uid, "timetable", i.id)}><Trash2 size={15}/></button></div></article>)}</section>)}</div>
    </section>
  </section>;
}
