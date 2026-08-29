"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarPlus, FileUp, Trash2 } from "lucide-react";
import { addMasterCalendarEvent, deleteMasterCalendarEvent, MasterCalendarEvent, parseIcsEvents, subscribeMasterCalendar } from "@/lib/master-calendar";

export function AdminMasterCalendar() {
  const [events, setEvents] = useState<MasterCalendarEvent[]>([]);
  const [status, setStatus] = useState("");
  useEffect(() => subscribeMasterCalendar(setEvents), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await addMasterCalendarEvent({
      title: String(data.get("title") || ""), start: String(data.get("start") || ""), end: String(data.get("end") || ""),
      location: String(data.get("location") || ""), description: String(data.get("description") || ""), source: "manual",
    });
    form.reset(); setStatus("Event added to the Master Calendar.");
  }

  async function importIcs(file: File) {
    const parsed = parseIcsEvents(await file.text());
    if (!parsed.length) { setStatus("No valid VEVENT entries were found in that .ics file."); return; }
    await Promise.all(parsed.map(addMasterCalendarEvent));
    setStatus(`Imported ${parsed.length} event${parsed.length === 1 ? "" : "s"} from ${file.name}.`);
  }

  return <section className="admin-section">
    <div className="section-row"><div><h2 className="section-title">Master Calendar</h2><p className="section-help">Add school events manually or import a standard .ics calendar file.</p></div></div>
    {status ? <div className="notice">{status}</div> : null}
    <form className="editor-card compact" onSubmit={submit}>
      <input name="title" placeholder="Event title" required/>
      <label>Starts<input name="start" type="datetime-local" required/></label>
      <label>Ends<input name="end" type="datetime-local"/></label>
      <input name="location" placeholder="Location (optional)"/>
      <textarea name="description" placeholder="Description (optional)"/>
      <button className="primary-button"><CalendarPlus size={17}/> Add event</button>
    </form>
    <div className="form-actions">
      <label className="text-button"><FileUp size={15}/> Import .ics<input type="file" accept=".ics,text/calendar" hidden onChange={e => { const file = e.target.files?.[0]; if (file) void importIcs(file); e.currentTarget.value = ""; }}/></label>
    </div>
    <div className="collection-list">{events.map(event => <article className="collection-card" key={event.id}><div><strong>{event.title}</strong><span>{event.start}</span><small>{event.source === "ics" ? "Imported from .ics" : "Manual entry"}</small></div><button className="icon-button danger" aria-label={`Delete ${event.title}`} onClick={() => void deleteMasterCalendarEvent(event.id)}><Trash2 size={15}/></button></article>)}</div>
  </section>;
}
