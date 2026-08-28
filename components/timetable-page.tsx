"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Building2, Pencil, Plus, School, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { addItem, deleteItem, subscribeCollection, TimetableClass, updateItem } from "@/lib/data";
import {
  DEFAULT_SES,
  isSesStudent,
  roomLocation,
  saveSchoolSelection,
  SchoolConfig,
  SchoolSelection,
  SchoolTimetableEntry,
  subscribeSchoolConfig,
  subscribeSchoolSelection,
  subscribeTimetable,
} from "@/lib/school-data";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function TimetablePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<TimetableClass[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TimetableClass | null>(null);
  const [config, setConfig] = useState<SchoolConfig | null>(null);
  const [selection, setSelection] = useState<SchoolSelection | null>(null);
  const [schoolEntries, setSchoolEntries] = useState<SchoolTimetableEntry[]>([]);
  const ses = isSesStudent(user?.email);

  useEffect(() => user ? subscribeCollection<TimetableClass>(user.uid, "timetable", setItems) : undefined, [user]);
  useEffect(() => ses ? subscribeSchoolConfig("ses", value => setConfig(value || DEFAULT_SES)) : undefined, [ses]);
  useEffect(() => user && ses ? subscribeSchoolSelection(user.uid, setSelection) : undefined, [user, ses]);
  useEffect(() => selection ? subscribeTimetable(selection, value => setSchoolEntries(value?.publishedEntries || [])) : undefined, [selection]);

  const year = config?.years.find(item => item.id === selection?.yearId) || config?.years[0];
  const schoolClass = year?.classes.find(item => item.id === selection?.classId) || year?.classes[0];
  const house = schoolClass?.houses.find(item => item.id === selection?.houseId) || schoolClass?.houses[0];

  const effectiveSelection = useMemo<SchoolSelection | null>(() => {
    if (!config || !year || !schoolClass || !house) return null;
    return { schoolId: config.id, yearId: year.id, classId: schoolClass.id, houseId: house.id };
  }, [config, year, schoolClass, house]);

  async function choose(next: Partial<SchoolSelection>) {
    if (!user || !config) return;
    const nextYearId = next.yearId || effectiveSelection?.yearId || config.years[0]?.id;
    const nextYear = config.years.find(y => y.id === nextYearId);
    const nextClassId = next.classId || (next.yearId ? nextYear?.classes[0]?.id : effectiveSelection?.classId) || nextYear?.classes[0]?.id;
    const nextClass = nextYear?.classes.find(c => c.id === nextClassId);
    const nextHouseId = next.houseId || (next.classId || next.yearId ? nextClass?.houses[0]?.id : effectiveSelection?.houseId) || nextClass?.houses[0]?.id;
    if (!nextYearId || !nextClassId || !nextHouseId) return;
    const value = { schoolId: config.id, yearId: nextYearId, classId: nextClassId, houseId: nextHouseId };
    setSelection(value);
    await saveSchoolSelection(user.uid, value);
  }

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
    const found = roomLocation(room, config || DEFAULT_SES);
    return found && found.building !== "Unknown building" ? `${found.code} · ${found.building}` : room;
  }

  return <section className="page">
    <div className="page-head">
      <div><p className="eyebrow">Your week</p><h1>Timetable</h1><p>{ses ? "Use your SES class timetable and add your own personal changes." : "Build the school week you actually follow."}</p></div>
      <button className="primary-button" onClick={() => { setEditing(null); setOpen(v => !v); }}><Plus size={17}/> Add class</button>
    </div>

    {ses && config ? <section className="school-setup-card">
      <div className="section-row"><div><span className="school-source-badge"><School size={14}/> Sharjah English School</span><h2 className="section-title">School timetable</h2><p className="section-help">Choose your year, class and house. Your published timetable updates automatically when the MStudy admin publishes changes.</p></div></div>
      <div className="school-setup-grid">
        <label>Year<select value={year?.id || ""} onChange={e => void choose({ yearId: e.target.value })}>{config.years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}</select></label>
        <label>Class<select value={schoolClass?.id || ""} onChange={e => void choose({ classId: e.target.value })}>{year?.classes.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        <label>House<select value={house?.id || ""} onChange={e => void choose({ houseId: e.target.value })}>{schoolClass?.houses.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}</select></label>
      </div>
      {!selection && effectiveSelection ? <div className="form-actions"><button className="primary-button" onClick={() => void choose(effectiveSelection)}>Use this timetable</button></div> : null}
    </section> : null}

    {open ? <form className="editor-card compact" onSubmit={submit}>
      <input name="subject" placeholder="Subject" defaultValue={editing?.subject || ""} required/>
      <select name="day" defaultValue={editing?.day || "Monday"} required>{days.map(d => <option key={d}>{d}</option>)}</select>
      <input name="startTime" type="time" defaultValue={editing?.startTime || ""} required/>
      <input name="endTime" type="time" defaultValue={editing?.endTime || ""} required/>
      <input name="room" placeholder="Room" defaultValue={editing?.room || ""}/>
      <input name="teacher" placeholder="Teacher" defaultValue={editing?.teacher || ""}/>
      <button className="primary-button">{editing ? "Save changes" : "Save class"}</button>
    </form> : null}

    {ses && selection ? <section className="school-week">
      <div className="section-row"><div><h2 className="section-title">Published school timetable</h2><p className="section-help">{year?.label} → {schoolClass?.label} → {house?.label}</p></div></div>
      {schoolEntries.length === 0 ? <div className="school-empty">No published timetable has been added for this class and house yet.</div> : <div className="week-grid">{days.map(day => <section className="day-column" key={day}><h2>{day}</h2>{schoolEntries.filter(i => i.day === day).sort((a,b) => a.startTime.localeCompare(b.startTime)).map(i => <article className="class-card" key={i.id}><div><strong>{i.subject || i.type || "School activity"}</strong><span>{i.startTime}–{i.endTime}</span><small>{i.room ? <button className="room-link" onClick={() => router.push(`/class-locator?room=${encodeURIComponent(i.room)}`)}>{roomText(i.room)}</button> : null}{i.teacher ? <span>{i.teacher}</span> : null}</small></div></article>)}</section>)}</div>}
    </section> : null}

    <section className="school-week">
      <div className="section-row"><div><h2 className="section-title">{ses ? "My personal timetable" : "My timetable"}</h2><p className="section-help">These classes belong only to you and can be edited at any time.</p></div></div>
      <div className="week-grid">{days.map(day => <section className="day-column" key={day}><h2>{day}</h2>{items.filter(i => i.day === day).sort((a,b) => a.startTime.localeCompare(b.startTime)).map(i => <article className="class-card" key={i.id}><div><strong>{i.subject}</strong><span>{i.startTime}–{i.endTime}</span><small>{i.room ? <span className="school-room-meta"><Building2 size={12}/> {roomText(i.room)}</span> : null}{i.teacher ? <span>{i.teacher}</span> : null}</small></div><div><button className="icon-button" aria-label={`Edit ${i.subject}`} onClick={() => edit(i)}><Pencil size={15}/></button><button className="icon-button danger" aria-label={`Delete ${i.subject}`} onClick={() => user && deleteItem(user.uid, "timetable", i.id)}><Trash2 size={15}/></button></div></article>)}</section>)}</div>
    </section>
  </section>;
}
